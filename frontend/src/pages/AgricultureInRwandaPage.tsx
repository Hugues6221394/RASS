import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Landmark, LineChart, Sprout, Tractor, Users } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PriceChart } from '../components/charts/PriceChart';
import agriHeroFarm from '../assets/agri/rwanda-hero-farm.jpg';
import agriFarmersField from '../assets/agri/rwanda-farmers-field.jpg';
import agriCooperativeField from '../assets/agri/rwanda-cooperative-field.jpg';
import agriTerraceCrops from '../assets/agri/rwanda-terrace-crops.jpg';
import agriFarmWorkers from '../assets/agri/rwanda-farm-workers.jpg';
import agriCropLandscape from '../assets/agri/rwanda-crop-landscape.jpg';
import agriHarvestTeam from '../assets/agri/rwanda-harvest-team.jpg';

const agricultureStats = [
  { label: 'Agriculture share of GDP (2024)', value: '24.6%', note: 'World Bank indicator NV.AGR.TOTL.ZS.', icon: <LineChart className="h-5 w-5" /> },
  { label: 'Employment in agriculture (2024)', value: '36.5%', note: 'World Bank/ILO modeled estimate SL.AGR.EMPL.ZS.', icon: <Users className="h-5 w-5" /> },
  { label: 'Agricultural land share (2023)', value: '76.3%', note: 'World Bank indicator AG.LND.AGRI.ZS.', icon: <Tractor className="h-5 w-5" /> },
  { label: 'Cereal production (2023)', value: '846k tons', note: 'World Bank indicator AG.PRD.CREL.MT.', icon: <Landmark className="h-5 w-5" /> },
];

const impactPillars = [
  {
    title: 'Transparent markets for farmers',
    body: 'RASS reduces information asymmetry by showing structured listings, clearer prices, and role-based workflows so farmers and cooperatives can negotiate from better data.',
  },
  {
    title: 'Better planning with real-time intelligence',
    body: 'From prices and logistics to contracts and notifications, the platform builds continuous operational visibility that helps all actors make faster and safer decisions.',
  },
  {
    title: 'Stronger trust and accountability',
    body: 'Digitized records, auditable actions, and controlled role permissions improve trust between citizens, cooperatives, buyers, transporters, and institutions.',
  },
  {
    title: 'Economic contribution at national scale',
    body: 'More efficient value chains can reduce post-harvest losses, improve transaction speed, and support national goals around food security, exports, and inclusive growth.',
  },
];

const historicalTimeline = [
  {
    period: '1960s–1980s',
    title: 'Agriculture-dominant national economy',
    detail:
      'Historical data indicates agriculture made up a very large share of national value added, while most households depended on subsistence and rain-fed farming systems.',
  },
  {
    period: '1990s',
    title: 'Recovery under difficult conditions',
    detail:
      'The decade included major shocks and recovery efforts. Data series show deep volatility in production and land-use dynamics, followed by rebuilding of institutions and supply systems.',
  },
  {
    period: '2000s',
    title: 'Sector modernization and policy reform',
    detail:
      'Rwanda intensified agricultural transformation through stronger extension support, cooperative development, and market-oriented planning, improving output performance in many value chains.',
  },
  {
    period: '2010s',
    title: 'Productivity and commercialization push',
    detail:
      'Cereal output rose substantially versus early-2000 levels, while broader structural transformation reduced agriculture’s employment share as non-farm sectors expanded.',
  },
  {
    period: '2020s',
    title: 'Digital agriculture and resilience priorities',
    detail:
      'Recent years emphasize climate resilience, logistics reliability, traceability, and digital coordination across farm production, market access, and public-sector monitoring.',
  },
];

const gdpShareTrend = [
  { name: '1970', value: 61.6 },
  { name: '1980', value: 45.8 },
  { name: '1990', value: 32.5 },
  { name: '2000', value: 31.2 },
  { name: '2010', value: 24.3 },
  { name: '2020', value: 26.7 },
  { name: '2024', value: 24.6 },
];

const agriEmploymentTrend = [
  { name: '1995', value: 80.4 },
  { name: '2000', value: 79.1 },
  { name: '2005', value: 72.6 },
  { name: '2010', value: 62.0 },
  { name: '2015', value: 54.7 },
  { name: '2020', value: 50.1 },
  { name: '2024', value: 36.5 },
];

const cerealTrend = [
  { name: '1994', value: 130073 },
  { name: '2000', value: 239705 },
  { name: '2005', value: 413314 },
  { name: '2010', value: 676548 },
  { name: '2015', value: 612865 },
  { name: '2020', value: 751907 },
  { name: '2023', value: 846384 },
];

const districtVoices = [
  {
    district: 'Rulindo (Northern Province)',
    insight:
      'Field reporting frequently highlights gains from improved agronomic practices, especially where advisory support and organized market channels are available.',
  },
  {
    district: 'Nyagatare (Eastern Province)',
    insight:
      'Farmers often emphasize better market timing and transport reliability as key needs to reduce post-harvest losses and improve household income consistency.',
  },
  {
    district: 'Huye (Southern Province)',
    insight:
      'Cooperative-based aggregation and quality-focused handling continue to appear as strong drivers of better bargaining power for smallholders.',
  },
  {
    district: 'Karongi (Western Province)',
    insight:
      'Producers and traders regularly point to pricing visibility and buyer trust as major factors that influence whether produce reaches higher-value channels.',
  },
  {
    district: 'Gasabo (Kigali City peri-urban belts)',
    insight:
      'Urban-adjacent agriculture discussions often center on fast logistics, cold-chain coordination, and digital ordering links with buyers and institutions.',
  },
];

export const AgricultureInRwandaPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-10 px-4 pb-16 pt-8 sm:px-6">
        <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-900">
          <img src={agriHeroFarm} alt="Agriculture in Rwanda" className="absolute inset-0 h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/85 to-emerald-900/50" />
          <div className="relative z-10 px-6 py-14 sm:px-10 lg:px-14">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300"
            >
              Public Knowledge Hub
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="max-w-3xl text-4xl font-black leading-tight text-white sm:text-5xl"
            >
              Agriculture in Rwanda
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="mt-4 max-w-3xl text-base text-emerald-100/90 sm:text-lg"
            >
              Rwanda&apos;s agriculture is a strategic pillar for livelihoods, food systems, and national economic resilience. This extended page covers historical trends, district-level field perspectives, and why digital infrastructure like RASS matters for farmers and national planning.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="mt-7 flex flex-wrap gap-3"
            >
              <Button size="lg" onClick={() => navigate('/marketplace')} rightIcon={<ArrowRight className="h-4 w-4" />}>
                Explore marketplace
              </Button>
              <Button variant="outline" size="lg" className="border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={() => navigate('/register')}>
                Join the platform
              </Button>
            </motion.div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900">Current statistical snapshot</h2>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">National snapshot</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {agricultureStats.map((item, idx) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.05 }}>
                <Card className="h-full p-5">
                  <div className="flex items-center gap-2 text-emerald-700">
                    {item.icon}
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sector indicator</p>
                  </div>
                  <p className="mt-3 text-3xl font-black text-slate-900">{item.value}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{item.label}</p>
                  <p className="mt-2 text-xs text-slate-500">{item.note}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <h2 className="text-2xl font-black text-slate-900">Historical context of agriculture in Rwanda</h2>
            <p className="mt-3 text-sm text-slate-600">
              For decades, agriculture has been central to Rwanda&apos;s economy and social stability. Over time, national data shows a long structural shift: agriculture remains crucial, but its share in total employment and GDP has gradually decreased as other sectors expanded. This is a common pattern in economies modernizing beyond subsistence production.
            </p>
            <p className="mt-3 text-sm text-slate-600">
              Yet the sector continues to carry strategic weight for food security, exports, and rural incomes. The challenge is no longer only increasing volumes; it is also improving value-chain efficiency, quality controls, market transparency, and resilience against climate and logistics shocks.
            </p>
            <p className="mt-3 text-sm text-slate-600">
              Platforms like RASS support this shift by making agricultural operations more visible, auditable, and coordinated between farmers, cooperatives, buyers, transporters, and public institutions.
            </p>
          </Card>
          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-900">Why this historical view matters</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>• Connects farm realities to macroeconomic trends</li>
              <li>• Shows where modernization has worked</li>
              <li>• Highlights persisting bottlenecks by district</li>
              <li>• Helps policy and private actors target interventions</li>
            </ul>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900">Agriculture through the years</h2>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Historical timeline</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {historicalTimeline.map((item, idx) => (
              <motion.div key={item.period} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.05 }}>
                <Card className="h-full p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">{item.period}</p>
                  <h3 className="mt-2 text-lg font-black text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900">Long-run statistical trends</h2>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Data history</p>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <PriceChart title="Agriculture share of GDP (%)" data={gdpShareTrend} />
            <PriceChart title="Agriculture employment share (%)" data={agriEmploymentTrend} />
            <PriceChart title="Cereal production (metric tons)" data={cerealTrend} />
          </div>
          <Card className="p-4">
            <p className="text-xs text-slate-500">
              Trend charts are assembled from World Bank indicator series for Rwanda and shown for readability across selected years.
            </p>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="overflow-hidden p-0 lg:col-span-2">
            <img src={agriTerraceCrops} alt="Rwandan farmers in terraced fields" className="h-72 w-full object-cover" />
            <div className="p-5">
              <h3 className="text-xl font-black text-slate-900">Rwandan farmers at the center of development</h3>
              <p className="mt-2 text-sm text-slate-600">
                Smallholder farmers, cooperatives, and local market actors drive everyday food supply and major value chains. When these actors gain access to reliable market information and digital workflows, productivity and incomes can improve.
              </p>
            </div>
          </Card>
          <Card className="overflow-hidden p-0">
            <img src={agriCooperativeField} alt="Cooperative operations in Rwanda" className="h-72 w-full object-cover" />
            <div className="p-5">
              <h3 className="text-lg font-black text-slate-900">Cooperative strength</h3>
              <p className="mt-2 text-sm text-slate-600">
                Cooperative organization helps farmers aggregate output, improve quality controls, and reach bigger markets more effectively.
              </p>
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900">Farm life and productivity</h2>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Field visuals</p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="overflow-hidden p-0">
              <img src={agriFarmersField} alt="Farm productivity and field activity in Rwanda" className="h-64 w-full object-cover" />
              <div className="p-4">
                <p className="text-sm font-black text-slate-900">Farm productivity and field activity</p>
                <p className="mt-1 text-xs text-slate-500">Farm-focused imagery showing day-to-day production effort and field coordination.</p>
              </div>
            </Card>
            <Card className="overflow-hidden p-0">
              <img src={agriHarvestTeam} alt="Farm teams and harvest quality in Rwanda" className="h-64 w-full object-cover" />
              <div className="p-4">
                <p className="text-sm font-black text-slate-900">Coffee and tea value chains</p>
                <p className="mt-1 text-xs text-slate-500">High-value crops continue to shape export potential and rural household opportunities.</p>
              </div>
            </Card>
            <Card className="overflow-hidden p-0">
              <img src={agriCropLandscape} alt="Staple crop production in Rwanda" className="h-64 w-full object-cover" />
              <div className="p-4">
                <p className="text-sm font-black text-slate-900">Staple crops for food security</p>
                <p className="mt-1 text-xs text-slate-500">Maize, beans, potatoes, and rice remain core to national food systems and household resilience.</p>
              </div>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900">District-level voices and field experiences</h2>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Across Rwanda</p>
          </div>
          <Card className="p-5">
            <p className="text-sm text-slate-600">
              The perspectives below summarize recurring field themes reported in agriculture and development articles covering different parts of Rwanda. They are district-focused summaries, not direct quotations from named individuals.
            </p>
          </Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {districtVoices.map((voice, idx) => (
              <motion.div key={voice.district} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.05 }}>
                <Card className="h-full p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">{voice.district}</p>
                  <p className="mt-2 text-sm text-slate-600">{voice.insight}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900">What RASS is solving</h2>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Platform impact</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {impactPillars.map((pillar, idx) => (
              <motion.div key={pillar.title} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.05 }}>
                <Card className="h-full p-5">
                  <h3 className="text-lg font-black text-slate-900">{pillar.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{pillar.body}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900">How RASS contributes to Rwanda&apos;s economy</h2>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">National contribution pathway</p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><Sprout className="h-5 w-5 text-emerald-700" />For farmers and cooperatives</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>• Better price discovery and planning signals</li>
                <li>• Faster access to buyers through structured listings</li>
                <li>• Improved trust via auditable contracts and role controls</li>
                <li>• Lower coordination friction across logistics and delivery</li>
              </ul>
            </Card>
            <Card className="p-5">
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><BookOpen className="h-5 w-5 text-emerald-700" />For institutions and government</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>• Cleaner operational data for policy and monitoring</li>
                <li>• More transparent market behavior across regions</li>
                <li>• Better visibility on trade and delivery reliability</li>
                <li>• Stronger evidence base for investment priorities</li>
              </ul>
            </Card>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => navigate('/marketplace')}>
              Explore active marketplace
            </Button>
            <Button variant="outline" onClick={() => navigate('/register')}>
              Create an account
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-black text-slate-900">Data and reference notes</h2>
          <Card className="p-5">
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                • World Bank Data API — Agriculture value added (% GDP):{' '}
                <a className="text-emerald-700 underline" href="https://api.worldbank.org/v2/country/RWA/indicator/NV.AGR.TOTL.ZS?format=json&per_page=70" target="_blank" rel="noreferrer">NV.AGR.TOTL.ZS</a>
              </li>
              <li>
                • World Bank Data API — Employment in agriculture (% total employment):{' '}
                <a className="text-emerald-700 underline" href="https://api.worldbank.org/v2/country/RWA/indicator/SL.AGR.EMPL.ZS?format=json&per_page=70" target="_blank" rel="noreferrer">SL.AGR.EMPL.ZS</a>
              </li>
              <li>
                • World Bank Data API — Agricultural land (% land area):{' '}
                <a className="text-emerald-700 underline" href="https://api.worldbank.org/v2/country/RWA/indicator/AG.LND.AGRI.ZS?format=json&per_page=70" target="_blank" rel="noreferrer">AG.LND.AGRI.ZS</a>
              </li>
              <li>
                • World Bank Data API — Cereal production (metric tons):{' '}
                <a className="text-emerald-700 underline" href="https://api.worldbank.org/v2/country/RWA/indicator/AG.PRD.CREL.MT?format=json&per_page=70" target="_blank" rel="noreferrer">AG.PRD.CREL.MT</a>
              </li>
              <li>
                • World Bank Rwanda overview: <a className="text-emerald-700 underline" href="https://www.worldbank.org/en/country/rwanda/overview" target="_blank" rel="noreferrer">country overview and publications</a>
              </li>
              <li>
                • Field-story context used for district voice themes: <a className="text-emerald-700 underline" href="https://www.oneacrefund.org/our-stories" target="_blank" rel="noreferrer">One Acre Fund stories</a>
              </li>
            </ul>
          </Card>
        </section>
      </div>
    </div>
  );
};
