import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

const CONTACT_EMAIL = "tommy@buildinteg.com";
const VENMO_QR_IMAGE_PATH = "/venmo-qr.png";
const VENMO_QR_PDF_PATH = "/venmo-qr.pdf";

export default function ReadMePage() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div>
          <h1>Read Me</h1>
          <p>This software was created by Tommy Fieser of Building Integrity, who welcomes you to use it.</p>
          <p>I am using AI to translate my ideas into this super cool thing. Use responsibly!</p>
        </div>

        <section>
          <h2>Liability</h2>
          <p className={styles.shout}>
            Always keep in mind — anything coming from this app that you want to produce is your liability. I am not
            responsible for your project.
          </p>
        </section>

        <section>
          <h2>Support this tool</h2>
          <p>
            Creating and maintaining this app takes time and energy. If you feel so compelled to donate to this
            ever-changing, helpful, free-to-use tool, consider a donation with each project.
          </p>
          <div className={styles.donate}>
            <a href={VENMO_QR_PDF_PATH} target="_blank" rel="noopener noreferrer" className={styles.qrLink}>
              <Image src={VENMO_QR_IMAGE_PATH} alt="Venmo QR code for @Tommy-Fieser" width={1000} height={1294} className={styles.qrImage} />
            </a>
            <a href={VENMO_QR_PDF_PATH} target="_blank" rel="noopener noreferrer" className={styles.qrOpenLink}>
              Open as PDF ↗
            </a>
          </div>
        </section>

        <section>
          <p className={styles.shout}>Seriously, anything is possible.</p>
          <p>If you want something added to this app, please let me know at:</p>
          <p className={styles.emailLine}>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </section>

        <Link href="/">← Back to the layout editor</Link>
      </main>
    </div>
  );
}
