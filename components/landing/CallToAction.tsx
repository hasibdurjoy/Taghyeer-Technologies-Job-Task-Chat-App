import { Reveal } from '@/components/landing/Reveal';
import { StartCta } from '@/components/landing/StartCta';

export function CallToAction() {
  return (
    <section className="px-5 pb-16 sm:px-8 sm:pb-24">
      <Reveal className="mx-auto w-full max-w-6xl">
        <div className="brand-gradient relative overflow-hidden rounded-card px-6 py-14 text-center sm:px-12 sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />

          <div className="relative mx-auto max-w-xl">
            <h2 className="font-display text-3xl leading-tight tracking-tight text-white sm:text-[2.75rem]">
              Your next conversation is one number away
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-white/75">
              Sign in with your phone number and name. If it&apos;s your first time, the account
              creates itself.
            </p>
            <div className="mt-8 flex justify-center">
              <StartCta variant="onDark" />
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
