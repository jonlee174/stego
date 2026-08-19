import { useEffect, useState } from 'react';
import type { Nav } from '../App';
import { useDecks } from '../state/decks';
import { storageKind, storageLocation } from '../lib/storage';
import { ThemeToggle } from '../components/ui';
import { IconCards, IconPencil, IconQuiz } from '../components/Icons';
import titleArt from '../../assets/images/title.png';
import stegoArt from '../../assets/images/stego.png';
import trexArt from '../../assets/images/trex.png';

export default function Home({ nav }: { nav: Nav }) {
  const { decks } = useDecks();
  const [where, setWhere] = useState('');

  useEffect(() => {
    // Purely informational — never let a storage hiccup break the home screen.
    storageLocation().then(setWhere, () => setWhere(''));
  }, []);

  const cardTotal = decks.reduce((sum, d) => sum + d.cards.length, 0);

  return (
    <section className="screen home">
      <ThemeToggle />
      <div className="content">
        <div className="wrap home__inner">
          <header className="home__head">
            <img className="home__title" src={titleArt} alt="Stego" />
          </header>

          <nav className="home__tiles">
            <button className="tile tile--create" onClick={() => nav.go({ name: 'editor' })}>
              <IconPencil className="tile__icon" />
              <span className="tile__label">Create</span>
              <span className="tile__sub">Build a new deck</span>
            </button>

            <button
              className="tile tile--study"
              onClick={() => nav.go({ name: 'decks', intent: 'study' })}
            >
              <IconCards className="tile__icon" />
              <span className="tile__label">Study</span>
              <span className="tile__sub">Flip through your cards</span>
            </button>

            <button
              className="tile tile--test"
              onClick={() => nav.go({ name: 'decks', intent: 'test' })}
            >
              <IconQuiz className="tile__icon" />
              <span className="tile__label">Test</span>
              <span className="tile__sub">Write-in, true/false, matching</span>
              <img className="tile__mascot" src={trexArt} alt="" />
            </button>
          </nav>

          <footer className="home__foot">
            <button className="home__stats" onClick={() => nav.go({ name: 'decks' })}>
              <strong>{decks.length}</strong> {decks.length === 1 ? 'deck' : 'decks'} ·{' '}
              <strong>{cardTotal}</strong> {cardTotal === 1 ? 'card' : 'cards'}
            </button>
            {where && (
              <p className="home__where" title={where}>
                Saved to {storageKind() === 'browser' ? where : where.replace(/^file:\/\//, '')}
              </p>
            )}
          </footer>
        </div>
      </div>

      <img className="home__stego" src={stegoArt} alt="" />
    </section>
  );
}
