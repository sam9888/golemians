import Header from './components/Header';
import Hero from './components/Hero';
import GuardiansSystem from './components/GuardiansSystem';
import Utility from './components/Utility';
import Roadmap from './components/Roadmap';
import CityBuilder from './components/CityBuilder';
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
      <CityBuilder />
      <FAQ />
      <Footer />
    </main>
  );
}
