export type Role =
  | 'Admin'
  | 'Farmer'
  | 'CooperativeManager'
  | 'Buyer'
  | 'Transporter'
  | 'StorageOperator'
  | 'MarketAgent'
  | 'Government'
  | string;

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  fullName: string;
  roles: Role[];
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
}

export interface MarketPrice {
  id: string;
  market: string;
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
}

export interface BuyerOrder {
  id: string;
  crop: string;
  quantityKg: number;
  priceOffer: number;
  deliveryLocation: string;
  status: string;
  deliveryWindowStart: string;
  deliveryWindowEnd: string;
  buyer: string;
  marketListingId?: string;
  notes?: string;
  contracts?: string[];
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
  cooperative: {
    id: string;
    name: string;
    region: string;
    district: string;
    location: string;
  };
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

