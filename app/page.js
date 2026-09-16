import Header from './components/Header';
import Hero from './components/Hero';
import GuardiansSystem from './components/GuardiansSystem';
import Roadmap from './components/Roadmap';
import CityBuilder from './components/CityBuilder';
import Footer from './components/Footer';

export default function Home() {
  return (
    <main>
      <Header />
      <Hero />
      <GuardiansSystem />
      <Roadmap />
      <CityBuilder />
      <Footer />
    </main>
  );
}
