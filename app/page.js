import Header from './components/Header';
import Hero from './components/Hero';
import Roadmap from './components/Roadmap';
import GameComingSoon from './components/GameComingSoon';
import Footer from './components/Footer';

export default function Home() {
  return (
    <main>
      <Header />
      <Hero />
      <Roadmap />
      <GameComingSoon />
      <Footer />
    </main>
  );
}
