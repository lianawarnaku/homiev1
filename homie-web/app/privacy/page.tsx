import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="legal-shell">
      <Link className="brand simple-brand" href="/">
        SweetMate
      </Link>
      <article className="legal-card">
        <p className="eyebrow">Legal</p>
        <h1>Privacy Policy</h1>
        <p className="updated">Last updated July 23, 2026</p>
        <h2>What SweetMate stores</h2>
        <p>
          SweetMate stores account information and the household information you
          choose to share, including chores, expenses, shopping items, borrowed
          items, and household preferences.
        </p>
        <h2>How information is used</h2>
        <p>
          Information is used to operate SweetMate, synchronize household activity,
          keep your account secure, and provide the features you request. SweetMate
          does not sell personal information.
        </p>
        <h2>Shared household information</h2>
        <p>
          Information added to a household may be visible to other members of
          that household. Leave or delete a household before sharing an invite
          code with someone who should not have access.
        </p>
        <h2>Account deletion</h2>
        <p>
          You can request account deletion from the SweetMate Settings screen.
          Household owners can also remove household access for individual
          members.
        </p>
        <h2>Contact</h2>
        <p>
          Privacy questions can be sent to{" "}
          <a href="mailto:support@sweetmate.info">
            support@sweetmate.info
          </a>
          .
        </p>
      </article>
    </main>
  );
}
