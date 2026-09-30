import Header from '../components/Header';
import Footer from '../components/Footer';
import ArenaGame from './ArenaGame';

export const metadata = {
  title: 'The Arena | Golemians',
  description: 'GOLEMIANS: LAST ONE STANDING — a real-time battle royale on a collapsing arena. Last Golem standing takes the GLM pot.',
};

export default function ArenaPage() {
  return (
    <>
      <Header />
      <ArenaGame />
      <Footer />
    </>
  );
}
