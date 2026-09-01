import BrandLogo from '../../components/BrandLogo';
import { scrollToSection, navigate, LOGIN_PATH } from '../../routing';

const COLUMNS: { heading: string; links: { label: string; onClick: () => void }[] }[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Home', onClick: () => scrollToSection('home') },
      { label: 'Features', onClick: () => scrollToSection('features') },
      { label: 'How It Works', onClick: () => scrollToSection('how-it-works') },
      { label: 'About', onClick: () => scrollToSection('about') },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Contact', onClick: () => scrollToSection('about') },
      { label: 'Login', onClick: () => navigate(LOGIN_PATH) },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy Policy', onClick: () => scrollToSection('about') },
      { label: 'Terms', onClick: () => scrollToSection('about') },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5">
              <BrandLogo size={40} />
              <span className="text-lg font-bold tracking-tight">
                <span className="text-brand-950">Care</span>
                <span className="text-brand-600">Scribe</span>
              </span>
            </div>
            <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-500">
              Listens · Transcribes · Cares
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              An AI medical scribe that turns the spoken consultation into structured clinical
              documentation.
            </p>
          </div>

          {/* Link columns */}
          {COLUMNS.map(column => (
            <div key={column.heading}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-950">
                {column.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map(link => (
                  <li key={link.label}>
                    <button
                      type="button"
                      onClick={link.onClick}
                      className="text-sm text-slate-500 transition-colors hover:text-brand-700"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-slate-100 pt-6">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} CareScribe. Clinical documentation support only. Reports
            are drafts and must be reviewed by the treating clinician.
          </p>
        </div>
      </div>
    </footer>
  );
}
