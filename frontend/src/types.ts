export type Role =
  | 'Admin'
  | 'Farmer'
  | 'CooperativeManager'
  | 'Buyer'
  | 'Transporter'
  | 'StorageOperator'
  | 'Applicant'
  | 'MarketAgent'
  | 'Government'
  | string;

export interface User {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  role: Role;
}

export interface LoginRequest {
  identifier: string;
  password: string;
  otp?: string;
}

export interface LoginResponse {
  id: string;
  token: string;
  fullName: string;
  roles: Role[];
  requiresTwoFactor?: boolean;
  twoFactorMessage?: string | null;
}

export interface Lot {
  id: string;
  crop: string;
  quantityKg: number;
  qualityGrade: string;
  status: string;
  expectedHarvestDate: string;
  verified: boolean;
  cooperative?: string;
  farmer?: string;
  lotContributions?: {
    id: string;
    farmerId: string;
    quantityKg: number;
    contributedAt: string;
    farmer?: { fullName: string };
  }[];
}

export interface MarketPrice {
  id: string;
  market: string;
  region: string;
  district?: string;
  sector?: string;
  cell?: string;
  crop: string;
  observedAt: string;
  pricePerKg: number;
}

export interface StorageFacility {
  id: string;
  name: string;
  location: string;
  capacityKg: number;
  availableKg: number;
  features: string[];
}

export interface StorageBooking {
  id: string;
  quantityKg: number;
  startDate: string;
  endDate: string;
  status: string;
  facility: string;
  tracking?: string;
}

export interface TransportRequest {
  id: string;
  origin: string;
  destination: string;
  loadKg: number;
  pickupStart: string;
  pickupEnd: string;
  price: number;
  status: string;
  assignedTruck?: string;
  contractTracking?: string;
  contract?: {
    id: string;
    trackingId: string;
    crop: string;
    quantity: number;
  };
}

export interface BuyerOrder {
  id: string;
  crop: string;
  quantityKg: number;
  priceOffer: number;
  totalPrice?: number;
  deliveryLocation: string;
  status: string;
  deliveryWindowStart: string;
  deliveryWindowEnd: string;
  createdAt?: string;
  // buyer is a nested object in the cooperative's view; absent in buyer's own view
  buyer?: { fullName: string; organization: string; phone?: string } | string;
  marketListingId?: string;
  notes?: string;
  contracts?: string[];
  contract?: {
    id: string;
    trackingId: string;
    agreedPrice: number;
    status?: string;
  };
  marketListing?: {
    id: string;
    cooperative?: string | { id: string; name: string };
    minimumPrice?: number;
  };
  listing?: {
    id: string;
    crop?: string;
  };
}

export interface Contract {
  id: string;
  buyerOrderId: string;
  agreedPrice: number;
  status: string;
  trackingId: string;
  buyer: string;
  lots: { lotId: string; crop: string; quantityKg: number }[];
}

export interface TrackingInfo {
  trackingId: string;
  status: string;
  order: {
    crop: string;
    market: string;
    deliveryLocation: string;
    deliveryWindowStart: string;
    deliveryWindowEnd: string;
  };
  transports: {
    status: string;
    origin: string;
    destination: string;
    assignedTruck?: string;
    pickupStart: string;
    pickupEnd: string;
  }[];
  storage: {
    status: string;
    facility: string;
    startDate: string;
    endDate: string;
  }[];
  driver?: {
    name?: string;
    phone?: string;
    vehicleType?: string;
    license?: string;
  };
}
export interface FarmerProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  nationalId: string;
  district: string;
  sector: string;
  crops: string;
  farmSizeHectares: number;
  soilType?: string;
  primaryCrops?: string;
  isActive: boolean;
  cooperative?: {
    id: string;
    name: string;
    location: string;
  };
}

export interface Cooperative {
  id: string;
  name: string;
  region: string;
  district: string;
  location: string;
  phone: string;
  email: string;
  isVerified: boolean;
  isActive: boolean;
  farmerCount: number;
  lotCount: number;
}

export interface HarvestDeclaration {
  id: string;
  crop: string;
  expectedQuantityKg: number;
  expectedHarvestDate: string;
  qualityIndicators: string;
  status: string;
  createdAt: string;
  farmer: {
    fullName: string;
    phone: string;
  };
  cooperative?: string;
}

export interface MarketListing {
  id: string;
  crop: string;
  quantityKg: number;
  minimumPrice: number;
  availabilityWindowStart: string;
  availabilityWindowEnd: string;
  description: string;
  qualityGrade: string;
  status: string;
  cooperative: {
    id: string;
    name: string;
    region: string;
    district: string;
    location: string;
  };
  primaryImage?: string;
  images?: { id: string; imageUrl: string; displayOrder: number }[];
}

export interface BuyerProfile {
  id: string;
  fullName: string;
  email: string;
  organization: string;
  businessType: string;
  location: string;
  phone: string;
  taxId: string;
  isVerified: boolean;
  isActive: boolean;
  orderCount: number;
  activeOrders: number;
}

export interface TransporterProfile {
  id: string;
  fullName: string;
  email: string;
  companyName: string;
  licenseNumber: string;
  phone: string;
  capacityKg: number;
  vehicleType: string;
  licensePlate: string;
  operatingRegions: string[];
  isVerified: boolean;
  isActive: boolean;
  isAvailable: boolean;
  activeJobs: number;
  completedJobs: number;
}

export interface TransportJob {
  id: string;
  origin: string;
  destination: string;
  loadKg: number;
  pickupStart: string;
  pickupEnd: string;
  price: number;
  status: string;
  assignedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  driverPhone?: string;
  assignedTruck?: string;
  notes?: string;
  contract?: {
    id: string;
    trackingId: string;
    crop: string;
    buyer: string;
  };
}

export interface PriceRegulation {
  id: string;
  crop: string;
  region: string;
  district?: string;
  market?: string;
  minPricePerKg?: number;
  maxPricePerKg: number;
  effectiveFrom: string;
  effectiveTo: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export interface SeasonalGuidance {
  id: string;
  crop: string;
  region: string;
  season: string;
  stabilityStart?: string;
  stabilityEnd?: string;
  expectedTrend: string;
  expectedMinPrice?: number;
  expectedMaxPrice?: number;
  notes?: string;
  recommendationForFarmers?: string;
  createdAt: string;
}

export interface GeneratedReport {
  reportType: string;
  generatedAt?: string;
  period?: string;
  filters?: Record<string, string | null>;
  summary?: Record<string, number | string>;
  data?: Record<string, unknown>[];
  insights?: string[];
  error?: string;
  [key: string]: unknown;
}

export interface PriceSubmission {
  id: string;
  crop: string;
  market: string;
  region: string;
  district?: string;
  pricePerKg: number;
  observedAt: string;
  verificationStatus: string;
  moderationNote?: string;
  moderatedAt?: string;
  agentName: string;
}

