import { motion } from 'framer-motion';
import { ArrowRight, PlayCircle } from 'lucide-react';
import { Button } from '../ui/Button';

interface HeroSectionProps {
  title: string;
  subtitle: string;
  ctaLabel: string;
  onPrimaryClick: () => void;
  onSecondaryClick: () => void;
  backgroundUrl: string;
}

export const HeroSection = ({
  title,
  subtitle,
  ctaLabel,
  onPrimaryClick,
  onSecondaryClick,
  backgroundUrl,
}: HeroSectionProps) => (
  <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-900">
    <img src={backgroundUrl} alt="Rwanda agriculture" className="absolute inset-0 h-full w-full object-cover opacity-45" />
    <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/80 to-emerald-900/40" />
    <div className="relative z-10 px-6 py-16 sm:px-10 lg:px-14">
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300"
      >
        National Agricultural Intelligence Platform
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="max-w-3xl text-4xl font-black leading-tight text-white sm:text-5xl"
      >
        {title}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="mt-5 max-w-2xl text-base text-emerald-100/90 sm:text-lg"
      >
        {subtitle}
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24 }}
        className="mt-8 flex flex-wrap gap-3"
      >
        <Button size="lg" onClick={onPrimaryClick} rightIcon={<ArrowRight className="h-4 w-4" />}>
          {ctaLabel}
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={onSecondaryClick}
          className="border-white/40 bg-white/10 text-white hover:bg-white/20"
          leftIcon={<PlayCircle className="h-4 w-4" />}
        >
          Explore marketplace
        </Button>
      </motion.div>
    </div>
  </section>
);

