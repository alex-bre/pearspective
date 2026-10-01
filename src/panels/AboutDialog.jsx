import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, ExternalLink, FileCode, FileText, IdCard, Scale, ShieldCheck, X } from 'lucide-react'
import { APP_VERSION, BUILD_LABEL, BUILD_SOURCE_URL, COMMIT_SHA } from '../buildInfo'
import PearMark from './PearMark'
import styles from './AboutDialog.module.css'

/**
 * Resolves a path against the deployment's base URL. `base` is `'./'`, so a
 * root-absolute `/LICENSE.txt` breaks as soon as the app is served from a
 * sub-path — which is where GitHub Pages serves it (`alex-bre.github.io/pearspective/`).
 */
const docUrl = (path) => `${import.meta.env.BASE_URL}${path}`

/**
 * The provider, as § 5 DDG and Art. 13 GDPR require it to be named. Kept in one
 * place because the Impressum and the privacy section have to agree on it.
 * Empty fields are dropped from the address block.
 */
const PROVIDER = {
  name: '',
  street: '',
  city: '',
  country: '',
  email: 'alex.brenner.cs@gmail.com',
}

/** Shown on the legal sections, so a reader can tell how current they are. */
const LEGAL_UPDATED = '1 October 2026'

/**
 * The documents this build has to be able to point at: the source of the
 * running version (AGPL § 13), and the licence and third-party notices, which
 * have to travel with the distributed build (AGPL § 4, MIT/ISC notice clauses).
 * vite.config.js ships the two text files; a link here that 404s is a
 * compliance bug.
 */
export const ABOUT_LINKS = [
  {
    href: BUILD_SOURCE_URL,
    external: true,
    icon: FileCode,
    label: 'Source code',
    note: `Build (${COMMIT_SHA})`,
  },
  {
    href: docUrl('LICENSE.txt'),
    icon: Scale,
    label: 'Licence — AGPL-3.0-only',
    note: 'What you may do with this code, and the warranty disclaimer',
  },
  {
    href: docUrl('THIRD-PARTY-NOTICES.txt'),
    icon: FileText,
    label: 'Third-party notices',
    note: 'Copyright notices of the bundled libraries',
  },
]

const ext = { target: '_blank', rel: 'noreferrer noopener' }

/** Section header for the two collapsed legal texts. */
function LegalSection({ icon: Icon, label, note, children }) {
  return (
    <details className={styles.section}>
      <summary className={styles.summary}>
        <ChevronRight className={styles.chevron} size={14} aria-hidden />
        <Icon className={styles.linkIcon} size={16} aria-hidden />
        <span className={styles.linkText}>
          <span className={styles.linkLabel}>{label}</span>
          <span className={styles.linkNote}>{note}</span>
        </span>
      </summary>
      <div className={styles.sectionBody}>
        {children}
        <p className={styles.updated}>Last updated {LEGAL_UPDATED}.</p>
      </div>
    </details>
  )
}

/**
 * Modal shown by the TopBar's info button: build identity, the documents above,
 * and the privacy policy and Impressum inline — this is a single-page app
 * served as static files, so a visitor has nowhere else to read them.
 */
export default function AboutDialog({ onClose }) {
  const cardRef = useRef(null)
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()
    // Capture phase, and no key gets past the dialog: useShortcuts would
    // otherwise clear the selection on Escape, or delete it on Delete, behind
    // a modal the user is reading. Default actions (Tab, Enter on a link) stand.
    const onKey = (e) => {
      e.stopPropagation()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  // Portalled out of the top bar, whose z-index would otherwise cap the backdrop's.
  return createPortal(
    <div
      className={styles.backdrop}
      onPointerDown={(e) => {
        if (!cardRef.current?.contains(e.target)) onClose()
      }}
    >
      <div className={styles.card} ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="about-title">
        <div className={styles.header}>
          <PearMark size={32} />
          <div className={styles.heading}>
            <h2 className={styles.title} id="about-title">
              <span className={styles.pear}>pear</span>spective
            </h2>
            <p className={styles.build} title={BUILD_LABEL}>
              Version {APP_VERSION} · build {COMMIT_SHA}
            </p>
          </div>
          <button className={styles.iconBtn} ref={closeRef} onClick={onClose} title="Close (Esc)">
            <X size={16} />
          </button>
        </div>

        <p className={styles.blurb}>
          A 3D editor that runs entirely in your browser. Nothing you build or import is uploaded — and nothing is
          saved either: the scene lives in this tab until you export it, and reloading or closing the tab discards it.
        </p>

        <ul className={styles.links}>
          {ABOUT_LINKS.map(({ href, external, icon: Icon, label, note }) => (
            <li key={href}>
              <a className={styles.link} href={href} {...ext}>
                <Icon className={styles.linkIcon} size={16} aria-hidden />
                <span className={styles.linkText}>
                  <span className={styles.linkLabel}>
                    {label}
                    {external && <ExternalLink className={styles.extIcon} size={11} aria-hidden />}
                  </span>
                  <span className={styles.linkNote}>{note}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>

        <LegalSection icon={ShieldCheck} label="Privacy policy" note="No tracking, no uploads — what leaves your browser, and where">
          <p>
            Pearspective has no server component, no account, and no login. It sets no cookies and runs no analytics,
            tracking, or crash reporting. Importing, editing, and exporting all happen in your browser — imported files
            are read locally, and nothing you build is uploaded.
          </p>

          <h3>Data stored on your device</h3>
          <p>
            Only your light/dark preference, once you pick one, is kept in this browser's local storage, under{' '}
            <code>pearspective.theme</code>. The scene itself is not stored anywhere. Nothing is transmitted, and the
            preference stays until you clear this site's data in your browser settings.
          </p>

          <h3>Fonts</h3>
          <p>
            The typefaces are loaded from Google Fonts, a service of Google Ireland Limited (Gordon House, Barrow
            Street, Dublin 4, Ireland). To fetch them, your browser connects to Google's servers, which receive your IP
            address, the time, your user agent, and the referring page. This serves a consistent display of the editor
            (Art. 6(1)(f) GDPR); a transfer to the USA cannot be ruled out. See the{' '}
            <a href="https://policies.google.com/privacy" {...ext}>
              Google Privacy Policy
            </a>
            .
          </p>

          <h3>Hosting</h3>
          <p>
            This site is served by GitHub Pages (GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107,
            USA), whose servers log technical access data — your IP address, the time, the file requested, your user
            agent, and any referring page — to deliver the site and keep it secure (Art. 6(1)(f) GDPR), which involves a
            transfer to the USA. Those logs are created and controlled by GitHub, not by the provider named below, who
            has no access to them; see the{' '}
            <a href="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement" {...ext}>
              GitHub Privacy Statement
            </a>
            .
          </p>

          <h3>Your rights</h3>
          <p>
            Controller under Art. 4(7) GDPR is the provider named under Impressum below. You have the rights to
            information, rectification, erasure, restriction, portability, and objection (Art. 15–21 GDPR) and may
            complain to a supervisory authority (Art. 77). In practice there is little to act on: no accounts and no
            database are held here, and requests about the server and font logs above have to go to GitHub and Google.
          </p>
        </LegalSection>

        <LegalSection icon={IdCard} label="Impressum" note="Provider identification under § 5 DDG">
          <h3>Provider</h3>
          <address className={styles.address}>
            {[PROVIDER.name, PROVIDER.street, PROVIDER.city, PROVIDER.country].filter(Boolean).map((line) => (
              <span key={line}>
                {line}
                <br />
              </span>
            ))}
            Email: {PROVIDER.email}
          </address>
          <p>
            Pearspective is a privately operated, non-commercial project, offered free of charge with no advertising
            and nothing for sale — hence no commercial register entry and no VAT identification number.
          </p>

          <h3>Liability</h3>
          <p>
            The app comes with no guarantee that it is correct or fit for any purpose; sections 15 and 16 of the{' '}
            <a href={docUrl('LICENSE.txt')} {...ext}>
              licence
            </a>{' '}
            disclaim warranty and liability, and statutory liability that cannot be excluded is unaffected. Linked
            external pages are the responsibility of their operators; a link will be removed on concrete indication
            that something is wrong.
          </p>

          <h3>Copyright</h3>
          <p>
            The source code is under the GNU Affero General Public License v3.0 only; the bundled libraries keep their
            own licences, listed above. The licence grants no rights to the project's name. Models you make with the
            editor are yours.
          </p>
        </LegalSection>

        <p className={styles.footnote}>
          Free software under the GNU Affero General Public License v3.0. It comes with absolutely no warranty.
        </p>
      </div>
    </div>,
    document.body,
  )
}
