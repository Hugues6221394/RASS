import { useTranslation } from 'react-i18next';

export const LicensingPage = () => {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-3xl font-black text-slate-900">{t('licensing.title', 'Licensing & Intellectual Property')}</h1>
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-lg font-semibold text-emerald-900">
          {t('licensing.hero', 'This platform was developed by {{team}}, a software engineering group from the Adventist University of Central Africa (AUCA).', { team: 'PsyQode' })}
        </p>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
        <h2 className="text-xl font-black">{t('licensing.ownership_title', 'Ownership Statement')}</h2>
        <p className="text-slate-700">
          {t('licensing.ownership_body_one', 'All source code, product design, data structures, branding assets, documentation, and operational workflows of this platform are proprietary works of PsyQode. All rights are reserved under applicable intellectual property laws.')}
        </p>
        <p className="text-slate-700">
          {t('licensing.ownership_body_two', 'No part of this platform may be copied, redistributed, reverse-engineered, commercially reused, or republished without prior written authorization from PsyQode.')}
        </p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
        <h2 className="text-xl font-black">{t('licensing.impact_title', 'Academic & National Impact Commitment')}</h2>
        <p className="text-slate-700">
          {t('licensing.impact_body', "PsyQode built this system to support transparent agricultural markets, strengthen Rwanda's food systems, and demonstrate AUCA's contribution to practical, high-impact digital innovation.")}
        </p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-600">
          {t('licensing.copyright', 'Copyright © {{year}} PsyQode (Adventist University of Central Africa). All rights reserved.', { year: new Date().getFullYear() })}
        </p>
      </section>
    </div>
  );
};

export default LicensingPage;
