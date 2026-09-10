import { useCallback, useEffect, useState } from 'react';
import type { Nav } from '../App';
import { ConfirmDialog, EmptyState, TopBar } from '../components/ui';
import { useToast } from '../components/Toast';
import { IconCheck, IconTrash, IconX } from '../components/Icons';
import { useDecks } from '../state/decks';
import { useAccount } from '../state/account';
import {
  blockUser,
  discardShare,
  listBlocks,
  listInbox,
  reportShare,
  unblockUser,
  type IncomingDeck,
} from '../lib/sharing';
import { isOffline } from '../lib/supabase';

export default function InboxScreen({ nav }: { nav: Nav }) {
  const { signedIn } = useAccount();
  const { importFile } = useDecks();
  const toast = useToast();
  const [items, setItems] = useState<IncomingDeck[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmBlock, setConfirmBlock] = useState<IncomingDeck | null>(null);
  const [confirmReport, setConfirmReport] = useState<IncomingDeck | null>(null);

  const load = useCallback(async () => {
    if (!signedIn) {
      setLoading(false);
      return;
    }
    try {
      const [inbox, blocks] = await Promise.all([listInbox(), listBlocks()]);
      setItems(inbox);
      setBlocked(blocks);
    } catch {
      if (isOffline()) toast('You are offline', 'bad');
      else toast('Could not load your inbox', 'bad');
    } finally {
      setLoading(false);
    }
  }, [signedIn, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function accept(item: IncomingDeck) {
    // Reuses the import path, so an accepted deck is re-keyed the same way a
    // deck from a file is and can never collide with one already here.
    importFile(JSON.stringify({ version: 1, decks: [item.deck] }));
    setItems((prev) => prev.filter((x) => x.id !== item.id));
    try {
      await discardShare(item.id);
    } catch {
      // The deck is already in the library; the row clears on the next visit.
    }
    toast(`Added "${item.deckName}"`);
  }

  async function reject(item: IncomingDeck) {
    setItems((prev) => prev.filter((x) => x.id !== item.id));
    try {
      await discardShare(item.id);
      toast('Deck rejected');
    } catch {
      toast('Could not reject that deck', 'bad');
      void load();
    }
  }

  if (!signedIn) {
    return (
      <section className="screen">
        <TopBar title="Sent to me" onBack={() => nav.back()} />
        <div className="content">
          <EmptyState
            title="Sign in to receive decks"
            body="Decks are sent to your username, so you need an account to get them."
            action={
              <button className="btn" onClick={() => nav.go({ name: 'account' })}>
                Sign in
              </button>
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section className="screen">
      <TopBar title="Sent to me" onBack={() => nav.back()} />

      <div className="content">
        <div className="wrap stack">
          {loading ? (
            <p className="hint">Loading.</p>
          ) : items.length === 0 ? (
            <EmptyState
              title="Nothing waiting"
              body="Decks other people send you land here first. Nothing is added to your library until you accept it."
            />
          ) : (
            <ul className="inbox">
              {items.map((item) => (
                <li key={item.id} className="panel inbox__item">
                  <div className="inbox__head">
                    <span className="inbox__name">{item.deckName}</span>
                    <span className="chip">
                      {item.cardCount} {item.cardCount === 1 ? 'card' : 'cards'}
                    </span>
                  </div>
                  <p className="hint">
                    From <strong>{item.from}</strong> ·{' '}
                    {new Date(item.sentAt).toLocaleDateString()}
                  </p>

                  <div className="row inbox__actions">
                    <button className="btn" onClick={() => void accept(item)}>
                      <IconCheck className="btn__icon" />
                      Add to my decks
                    </button>
                    <button className="btn btn--ghost" onClick={() => void reject(item)}>
                      <IconX className="btn__icon" />
                      Reject
                    </button>
                    <span className="spacer" />
                    <button
                      className="btn btn--quiet btn--sm"
                      onClick={() => setConfirmReport(item)}
                    >
                      Report
                    </button>
                    <button
                      className="btn btn--quiet btn--sm"
                      onClick={() => setConfirmBlock(item)}
                    >
                      Block
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {blocked.length > 0 && (
            <div className="panel stack">
              <span className="panel__title">Blocked</span>
              <p className="hint">These people cannot send you decks.</p>
              <ul className="inbox__blocked">
                {blocked.map((name) => (
                  <li key={name}>
                    <span>{name}</span>
                    <button
                      className="btn btn--quiet btn--sm"
                      onClick={() => {
                        void unblockUser(name).then(() => {
                          setBlocked((prev) => prev.filter((n) => n !== name));
                          toast(`Unblocked ${name}`);
                        });
                      }}
                    >
                      <IconTrash className="btn__icon" />
                      Unblock
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {confirmBlock && (
        <ConfirmDialog
          title={`Block ${confirmBlock.from}?`}
          body="They will not be able to send you decks again. Anything they already sent is rejected."
          confirmLabel="Block"
          onCancel={() => setConfirmBlock(null)}
          onConfirm={() => {
            const item = confirmBlock;
            setConfirmBlock(null);
            void blockUser(item.from)
              .then(() => discardShare(item.id))
              .then(() => {
                setItems((prev) => prev.filter((x) => x.from !== item.from));
                setBlocked((prev) => [...prev, item.from.toLowerCase()]);
                toast(`Blocked ${item.from}`);
              })
              .catch(() => toast('Could not block that user', 'bad'));
          }}
        />
      )}

      {confirmReport && (
        <ConfirmDialog
          title={`Report ${confirmReport.from}?`}
          body="This sends the deck and the sender's username for review. The deck is rejected at the same time."
          confirmLabel="Report"
          onCancel={() => setConfirmReport(null)}
          onConfirm={() => {
            const item = confirmReport;
            setConfirmReport(null);
            void reportShare(item)
              .then(() => discardShare(item.id))
              .then(() => {
                setItems((prev) => prev.filter((x) => x.id !== item.id));
                toast('Reported. Thank you.');
              })
              .catch(() => toast('Could not send that report', 'bad'));
          }}
        />
      )}
    </section>
  );
}
