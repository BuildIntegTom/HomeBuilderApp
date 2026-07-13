import Link from "next/link";
import styles from "./page.module.css";

const CONTACT_EMAIL = "tommy@buildinteg.com";

export default function ReportBugPage() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div>
          <h1>Report Bug / Request Feature</h1>
          <p>
            This app is being developed by Tommy Fieser of the Seed Collaborative and Building Integrity.
          </p>
        </div>

        <section>
          <h2>Found a bug or glitch?</h2>
          <p>
            Please send an email that includes:
            <br />
            1) how you got to the bug, and
            <br />
            2) what you would like to see instead.
          </p>
          <p className={styles.example}>
            <span className={styles.shout}>FOR EXAMPLE:</span> When I open the app on my phone, draw a rectangular
            wall plan, and then pan the screen, it leaves a repeated drawing of the wall plan and looks like an
            absolute mess. Make it so that the image renders correctly, not leaving a trail of images.
          </p>
        </section>

        <section>
          <h2>Have an idea for a feature?</h2>
          <p className={styles.shout}>Keep in mind: ANYTHING IS POSSIBLE with what this app does.</p>
          <p>
            Please tell me:
            <br />
            1) what the feature is, and
            <br />
            2) where it should be.
          </p>
          <p className={styles.example}>
            <span className={styles.shout}>FOR EXAMPLE:</span> On roof options, I want to see a fully panelized roof
            system that we can make on the table complete with 3D modeling and pre-engineered guesstimates at its
            deflection and load bearing capabilities. These roof panels should be 3&apos; wide and have options to be
            slideable. When applicable, they should land directly above wall seams.
          </p>
        </section>

        <section>
          <p>Please include the date noticed/idea conceived and send to:</p>
          <p className={styles.emailLine}>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </section>

        <Link href="/">← Back to the layout editor</Link>
      </main>
    </div>
  );
}
