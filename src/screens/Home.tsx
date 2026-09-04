import type { Nav } from '../App';
import { useDecks } from '../state/decks';
import { ThemeToggle } from '../components/ui';
import { Mascot } from '../components/Dinos';
import { IconSettings } from '../components/Icons';
import { useDino } from '../state/theme';
import { IconCards, IconPencil, IconQuiz } from '../components/Icons';
import titleArt from '../../assets/images/title.png';

export default function Home({ nav }: { nav: Nav }) {
  const { decks } = useDecks();
  const [dino] = useDino();

  const cardTotal = decks.reduce((sum, d) => sum + d.cards.length, 0);

  return (
    <section className="screen home">
      <div className="home__tools">
        <button
          className="btn btn--quiet btn--icon"
          onClick={() => nav.go({ name: 'settings' })}
          title="Settings"
          aria-label="Settings"
        >
          <IconSettings className="btn__icon" />
        </button>
        <ThemeToggle />
      </div>
      <div className="content">
        <div className="wrap home__inner">
          <header className="home__head">
            <span
              className="home__title"
              role="img"
              aria-label="Stego"
              style={{ ['--wordmark' as string]: `url(${titleArt})` }}
            />
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
            </button>
          </nav>

          <footer className="home__foot">
            <button className="home__stats" onClick={() => nav.go({ name: 'decks' })}>
              <strong>{decks.length}</strong> {decks.length === 1 ? 'deck' : 'decks'} ·{' '}
              <strong>{cardTotal}</strong> {cardTotal === 1 ? 'card' : 'cards'}
            </button>
          </footer>
        </div>
      </div>

      <Mascot name={dino} className="home__stego" />
    </section>
  );
}
