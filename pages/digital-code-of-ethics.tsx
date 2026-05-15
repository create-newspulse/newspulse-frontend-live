import React from 'react';
import PublicBusinessPageLayout, { PageEyebrow, SectionHeading, SurfacePanel } from '../components/public/PublicBusinessPageLayout';

export default function DigitalCodeOfEthicsPage() {
  const grievanceEmail = 'grievance@newspulse.co.in';

  return (
    <PublicBusinessPageLayout
      title="Digital Code of Ethics"
      description="News Pulse Digital Code of Ethics — editorial principles, publishing standards, and grievance processes."
      contactEmail={grievanceEmail}
      tone="slate"
    >
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
        <SurfacePanel className="sm:p-6">
          <PageEyebrow tone="slate">NEWS PULSE</PageEyebrow>

          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-[3.1rem] sm:leading-[1.05]">
            Digital Code of Ethics
          </h1>

          <div className="mt-4 text-sm text-slate-700">
            <div>For News Pulse</div>
            <div className="mt-1">Last Updated: 14 May 2026</div>
            <div className="mt-1">Website: www.newspulse.co.in</div>
          </div>

          <div className="mt-4 text-base font-semibold text-slate-800">Responsible. Fair. Accurate. Accountable.</div>
          <div className="mt-2 text-sm text-slate-600">Prepared for public display and internal editorial reference.</div>
          <div className="mt-3 text-xs text-slate-400">www.newspulse.co.in Page 1 of 6</div>

          <p className="mt-6 text-sm leading-7 text-slate-600">
            News Pulse is committed to responsible, fair, accurate, and ethical digital journalism. This Digital Code of Ethics explains the editorial principles,
            publishing standards, correction practices, grievance redressal process, and user-safety safeguards followed by News Pulse. News Pulse respects
            freedom of speech and expression while also recognising its responsibility to publish news and information in a lawful, fair, sensitive, and
            accountable manner.
          </p>
        </SurfacePanel>

        <SurfacePanel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_220px] items-start">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">PUBLISHER</div>
              <div className="mt-2 text-lg font-black tracking-tight text-slate-950">News Pulse</div>
              <p className="mt-3 text-sm leading-7 text-slate-600">This public Code is part of our commitment to transparency, accuracy, fairness, and responsible journalism online.</p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {['Accuracy', 'Fairness', 'Transparency', 'Corrections', 'User Safety'].map((h) => (
                  <div key={h} className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
                    {h}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-[12px] border border-slate-200/70 bg-slate-50 p-3 text-sm">
                <div className="text-[11px] font-semibold text-slate-500">Website</div>
                <a href="https://www.newspulse.co.in" className="mt-1 block text-sky-700 underline">www.newspulse.co.in</a>
              </div>

              <div className="rounded-[12px] border border-slate-200/70 bg-slate-50 p-3 text-sm">
                <div className="text-[11px] font-semibold text-slate-500">Last Updated</div>
                <div className="mt-1">14 May 2026</div>
              </div>

              <div className="rounded-[12px] border border-slate-200/70 bg-slate-50 p-3 text-sm">
                <div className="text-[11px] font-semibold text-slate-500">Grievance Email</div>
                <a href={`mailto:${grievanceEmail}`} className="mt-1 block text-sky-700 underline">{grievanceEmail}</a>
              </div>

              <div className="rounded-[12px] border border-slate-200/70 bg-slate-50 p-3 text-sm">
                <div className="text-[11px] font-semibold text-slate-500">Public Document</div>
                <div className="mt-1">Digital Code of Ethics</div>
              </div>
            </div>
          </div>
        </SurfacePanel>
      </section>

      <section className="mt-8 space-y-6">
        <SurfacePanel>
          <SectionHeading title="1. Purpose of this Code" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">This Digital Code of Ethics has been created to ensure that News Pulse maintains high standards in digital news publishing. It is intended to guide our editorial decisions, newsroom practices, content review, correction handling, and public grievance redressal.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">This Code applies to news articles, reports, features, videos, images, explainers, editorials, sponsored content disclosures, community submissions, and any other public-facing content published by News Pulse.</p>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="2. Editorial Independence" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">News Pulse maintains editorial independence in its news selection, reporting, writing, editing, and publishing process.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">Editorial decisions are made in the interest of public information, accuracy, fairness, relevance, and social responsibility. Advertising, sponsorship, partnerships, or commercial interests must not improperly influence editorial judgment.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">Sponsored content, advertisements, brand promotions, or paid collaborations must be clearly identified wherever applicable.</p>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="3. Accuracy, Fairness, and Transparency" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">News Pulse aims to publish information that is accurate, verified, balanced, and presented in proper context.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">Before publishing, our editorial process should check:</p>
          <ul className="mt-2 list-disc pl-5 text-sm leading-7 text-slate-600">
            <li>source authenticity;</li>
            <li>factual accuracy;</li>
            <li>headline fairness;</li>
            <li>image/video relevance;</li>
            <li>date and location accuracy;</li>
            <li>whether the content may mislead readers;</li>
            <li>whether any serious allegation requires a response or clarification from the concerned party.</li>
          </ul>
          <p className="mt-3 text-sm leading-7 text-slate-600">News Pulse avoids publishing inaccurate, baseless, distorted, fabricated, or misleading material.</p>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="4. Source Verification" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">News Pulse gives preference to reliable sources such as official statements, government notices, verified agencies, court records, police updates, public documents, credible media references, field reports, and direct confirmations.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">Where information is developing or not fully confirmed, the article should clearly mention that the matter is developing, under investigation, or based on available information at the time of publication.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">Anonymous sources should be used carefully and only where necessary in the public interest.</p>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="5. Right of Reply" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">If a news report contains allegations or serious claims against any person, organisation, business, institution, public figure, or authority, News Pulse should make reasonable efforts to include their response, clarification, or version of events.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">If the response is received after publication, News Pulse may update the article with the response and mention the update date wherever required.</p>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="6. Corrections, Updates, and Takedowns" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">News Pulse is committed to correcting factual errors in a timely and transparent manner.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">If any published article contains incorrect, incomplete, outdated, or misleading information, News Pulse may:</p>
          <ul className="mt-2 list-disc pl-5 text-sm leading-7 text-slate-600">
            <li>correct the relevant portion;</li>
            <li>update the story with new facts;</li>
            <li>add a clarification note;</li>
            <li>remove inaccurate material;</li>
            <li>unpublish or delete the article where necessary;</li>
            <li>issue a correction where the error is significant.</li>
          </ul>
          <p className="mt-3 text-sm leading-7 text-slate-600">If a full report is found to be false, legally risky, harmful, or materially inaccurate, News Pulse may remove or disable access to the article after review.</p>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="7. Crime and Investigation Reporting" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">News Pulse follows extra care while reporting crime, police investigations, arrests, allegations, court matters, or sensitive disputes.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">News Pulse avoids declaring any person guilty before a final legal finding by a competent authority. Reports should use careful language such as:</p>
          <ul className="mt-2 list-disc pl-5 text-sm leading-7 text-slate-600">
            <li>“according to police”;</li>
            <li>“as per the complaint”;</li>
            <li>“the matter is under investigation”;</li>
            <li>“the accused has denied the allegation”;</li>
            <li>“the court is yet to decide the matter.”</li>
          </ul>
          <p className="mt-3 text-sm leading-7 text-slate-600">News Pulse avoids unnecessary speculation about evidence, witnesses, victims, accused persons, or ongoing investigations.</p>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="8. Sensitive Content and Protection of Victims" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">News Pulse follows strict caution while reporting matters involving:</p>
          <ul className="mt-2 list-disc pl-5 text-sm leading-7 text-slate-600">
            <li>sexual offences;</li>
            <li>rape or sexual assault;</li>
            <li>children and minors;</li>
            <li>child abuse;</li>
            <li>domestic violence;</li>
            <li>suicide or self-harm;</li>
            <li>communal tension;</li>
            <li>caste or religious conflict;</li>
            <li>riots or public violence;</li>
            <li>matrimonial and family disputes;</li>
            <li>adoption, custody, or juvenile matters.</li>
          </ul>
          <p className="mt-3 text-sm leading-7 text-slate-600">News Pulse must not reveal the identity of victims or minors where prohibited by law or where disclosure may cause harm. Personal details such as address, school, workplace, family identity, photographs, or identifying visuals must be handled with extreme care.</p>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="9. Communal, Religious, and Social Harmony" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">News Pulse avoids content that may unnecessarily inflame communal, caste, regional, linguistic, or religious tension.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">Reports involving sensitive communities or social groups should be written with factual accuracy, restraint, and public responsibility. Headlines must not exaggerate, provoke, or create hatred.</p>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="10. Defamation and Reputation Protection" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">News Pulse avoids publishing defamatory, malicious, baseless, or unverified allegations.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">Where allegations are newsworthy, the report should clearly distinguish between verified facts, claims, police statements, court records, opinions, and responses from concerned parties.</p>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="11. Copyright and Intellectual Property" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">News Pulse respects copyright, trademarks, and intellectual property rights.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">Text, photographs, videos, graphics, logos, documents, screenshots, third-party media, and other protected material should not be copied or used without permission, lawful basis, licence, public-domain status, fair dealing, or proper attribution where applicable.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">News Pulse also protects its own original content, logo, design, articles, images, videos, and editorial work from unauthorised reuse.</p>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="12. Images, Videos, AI Content, and Visual Accuracy" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">News Pulse must not use misleading images, unrelated thumbnails, manipulated visuals, fake videos, or wrongly attributed media.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">Where AI-assisted tools are used for translation, summarisation, proofreading, image support, or editorial assistance, final responsibility remains with the editorial team. AI-generated or AI-altered material should not be used to mislead readers.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">Deepfakes, synthetic media, edited visuals, or recreated scenes must be handled with clear labelling where applicable.</p>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="13. Sponsored Content and Advertising Disclosure" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">News Pulse may publish advertisements, sponsored features, sponsored articles, brand collaborations, or promotional material.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">Such content must be clearly labelled as applicable using terms such as:</p>
          <ul className="mt-2 list-disc pl-5 text-sm leading-7 text-slate-600">
            <li>Advertisement;</li>
            <li>Sponsored;</li>
            <li>Sponsored Feature;</li>
            <li>Brand Promotion;</li>
            <li>Partner Content.</li>
          </ul>
          <p className="mt-3 text-sm leading-7 text-slate-600">Sponsored content should not be presented as independent editorial reporting.</p>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="14. Community Reporter and User Submissions" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">News Pulse may allow users, readers, or community reporters to submit news tips, photos, videos, local updates, or story ideas.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">Submission does not guarantee publication. All submissions may be reviewed for accuracy, legality, safety, relevance, copyright, and ethical compliance before publication.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">News Pulse may edit, reject, hold, or remove community-submitted content if it is found to be misleading, copied, unsafe, defamatory, promotional, hateful, illegal, or against this Code.</p>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="15. Grievance Redressal" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">News Pulse provides a grievance redressal process for complaints related to published content, corrections, copyright concerns, privacy concerns, or ethical issues.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">For grievances related to published content, users may contact:</p>
          <div className="mt-2 text-sm leading-7 text-slate-600">
            <div>Grievance Email: <a href={`mailto:${grievanceEmail}`} className="text-sky-700 underline">{grievanceEmail}</a></div>
            <div className="mt-1">Website: www.newspulse.co.in</div>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-600">A complaint should preferably include:</p>
          <ul className="mt-2 list-disc pl-5 text-sm leading-7 text-slate-600">
            <li>complainant’s full name;</li>
            <li>email address;</li>
            <li>article/page URL;</li>
            <li>complaint type;</li>
            <li>clear explanation of the issue;</li>
            <li>supporting documents or evidence, if any.</li>
          </ul>
          <p className="mt-3 text-sm leading-7 text-slate-600">News Pulse will review grievances in good faith and take appropriate action where required. Depending on the nature of the complaint, action may include correction, clarification, update, removal, rejection of complaint, or escalation for further review.</p>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="16. Monthly Compliance and Complaint Disclosure" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">News Pulse may maintain internal records of complaints received, resolved, pending, rejected, or escalated.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">A public monthly disclosure may show general complaint statistics, such as:</p>
          <ul className="mt-2 list-disc pl-5 text-sm leading-7 text-slate-600">
            <li>number of complaints received;</li>
            <li>number resolved;</li>
            <li>number pending;</li>
            <li>number rejected or invalid;</li>
            <li>number escalated.</li>
          </ul>
          <p className="mt-3 text-sm leading-7 text-slate-600">Personal details of complainants will not be published in monthly disclosure reports.</p>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="17. Privacy and Personal Data" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">News Pulse respects user privacy and avoids unnecessary publication of private personal information.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">Personal data received through contact forms, grievance forms, reporter submissions, or complaint channels should be used only for the purpose for which it was submitted, unless otherwise required by law.</p>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="18. Public Interest and Responsible Reporting" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">News Pulse may report matters of public interest, including governance, public safety, civic issues, social concerns, economy, education, health, environment, technology, sports, entertainment, and community developments.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">However, public interest does not justify careless reporting, unlawful publication, invasion of privacy, hate speech, victim identification, or publishing unverified harmful claims.</p>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="19. Editorial Review and Training" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">News Pulse aims to continuously improve its editorial standards through internal review, content checks, correction tracking, language quality checks, and ethical publishing practices.</p>
          <p className="mt-3 text-sm leading-7 text-slate-600">Editors, writers, contributors, and community reporters should be guided by this Code while preparing or submitting content.</p>
        </SurfacePanel>

        <SurfacePanel>
          <SectionHeading title="20. Review of this Code" description="" />
          <p className="mt-4 text-sm leading-7 text-slate-600">This Digital Code of Ethics may be updated from time to time to reflect changes in law, technology, newsroom practices, public feedback, regulatory guidance, or editorial standards. The latest version will be available on the News Pulse website.</p>
        </SurfacePanel>
      </section>

      <div className="mt-8">
        <div className="rounded-sm border-t border-slate-200/70 pt-4">
          <div className="border-l-2 border-slate-200/70 pl-4 text-sm text-slate-600">
            This Digital Code of Ethics is an internal editorial and compliance policy of News Pulse. It does not claim membership, approval, certification, or registration with any association, regulatory body, or government authority unless separately stated on the website
          </div>
        </div>
      </div>

    </PublicBusinessPageLayout>
  );
}
