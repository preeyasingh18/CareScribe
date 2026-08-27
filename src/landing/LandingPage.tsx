import type { RefObject } from 'react';
import Navbar from './sections/Navbar';
import Hero from './sections/Hero';
import About from './sections/About';
import HowItWorks from './sections/HowItWorks';
import Features from './sections/Features';
import BeforeAfter from './sections/BeforeAfter';
import CtaBand from './sections/CtaBand';
import Footer from './sections/Footer';

interface Props {
  /** Passed to the navbar so the intro animation can measure its landing spot. */
  markRef: RefObject<HTMLDivElement | null>;
  /** False while the intro still owns the on-screen mark. */
  markVisible: boolean;
  /** True when the intro just played — sections then animate in on first paint. */
  animateIn: boolean;
}

export default function LandingPage({ markRef, markVisible, animateIn }: Props) {
  return (
    <div className="min-h-screen bg-white">
      <Navbar markRef={markRef} markVisible={markVisible} animateIn={animateIn} />
      <main>
        <Hero animateIn={animateIn} />
        <About />
        <HowItWorks />
        <Features />
        <BeforeAfter />
        <CtaBand />
      </main>
      <Footer />
    </div>
  );
}
