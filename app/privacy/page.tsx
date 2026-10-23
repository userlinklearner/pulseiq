import type { Metadata } from 'next'
import { CONTACT_EMAIL, LegalPage } from '@/components/legal/LegalPage'

export const metadata: Metadata = { title: 'Privacy Policy — PulseIQ' }

// DRAFT: written from what the code does today. Have it reviewed for LGPD/GDPR before launch.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 23, 2026">
      <p>
        PulseIQ brings your wearable and training data into one place and uses it to give you coaching.
        This policy explains what we collect, why, who processes it, and the choices you have.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account data:</strong> name, email and the profile details you enter.</li>
        <li><strong>Device data you connect:</strong> from Oura and Whoop, with your permission, daily sleep, readiness or recovery, HRV, resting heart rate, SpO2, strain, steps, calories and workouts. From Garmin, only the files you choose to upload.</li>
        <li><strong>Data you enter:</strong> mood, energy, soreness, workouts, life events, medical exam results and messages to the AI coach.</li>
        <li><strong>Billing:</strong> handled by Stripe. We store your plan and subscription status, never your card number.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To show your dashboard, history and trends.</li>
        <li>To generate coaching and training plans. When you message the coach, your recent data is sent to our AI provider to produce the reply.</li>
        <li>To share data with a coach or doctor, only when you invite them and only the categories you allow.</li>
        <li>For community insights, only if you opt in. Shared data is anonymized and aggregated, never tied to your name or account.</li>
      </ul>
      <p>We do not sell your data and do not use it for advertising.</p>

      <h2>Who processes your data</h2>
      <ul>
        <li>Supabase (database and authentication)</li>
        <li>Vercel (hosting)</li>
        <li>Anthropic (AI coach responses)</li>
        <li>Stripe (payments)</li>
        <li>Oura and Whoop (only to fetch the data you authorized)</li>
      </ul>

      <h2>Health data</h2>
      <p>
        Health data is sensitive personal data under the LGPD (Brazil) and GDPR (EU). We process it on the basis of
        your consent, which you give when you connect a device or enter data, and which you can withdraw at any time.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li>Disconnect any device at any time from the Connect page. We stop syncing immediately.</li>
        <li>Ask us to access, correct, export or delete your data.</li>
        <li>Withdraw consent for community sharing or professional access at any time.</li>
      </ul>
      <p>Deleting your account deletes your health data, device connections and coach conversations.</p>

      <h2>Security</h2>
      <p>
        Device access tokens are stored server-side and are never sent to your browser. Access to your data is
        restricted per account at the database level. We never ask for your wearable account passwords.
      </p>

      {CONTACT_EMAIL && (
        <>
          <h2>Contact</h2>
          <p>Questions or requests: <a className="text-violet-400" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        </>
      )}
    </LegalPage>
  )
}
