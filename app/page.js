import Header from './components/Header';
import Hero from './components/Hero';
import GuardiansSystem from './components/GuardiansSystem';
import Utility from './components/Utility';
import Roadmap from './components/Roadmap';
import Allowlist from './components/Allowlist';
import LadderGame from './components/LadderGame';
import FAQ from './components/FAQ';
import Footer from './components/Footer';

export default function Home() {
  return (
    <main>
      <Header />
      <Hero />
      <GuardiansSystem />
      <Utility />
      <Roadmap />
      <Allowlist />
      <LadderGame />
      <FAQ />
      <Footer />
    </main>
  );
}
