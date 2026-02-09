import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/DataTable';
import type { TransporterProfile, TransportRequest } from '../types';

export const TransporterDashboardPage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<TransporterProfile | null>(null);
  const [availableJobs, setAvailableJobs] = useState<TransportRequest[]>([]);
  const [myJobs, setMyJobs] = useState<TransportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'available' | 'my-jobs' | 'profile'>('overview');

  // Modals
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<TransportRequest | null>(null);

  // Forms
  const [profileForm, setProfileForm] = useState({
    companyName: '',
    vehicleType: '',
    vehiclePlate: '',
    capacityKg: '',
    phone: '',
    availability: true
  });

  const [statusForm, setStatusForm] = useState({
    status: '',
    notes: '',
    proofOfDeliveryUrl: ''
  });

  useEffect(() => {
    loadTransporterData();
  }, []);

  const loadTransporterData = async () => {
    try {
      const [profileRes, availableRes, myJobsRes] = await Promise.all([
        api.get('/api/transporters/profile'),
        api.get('/api/transporters/available-jobs'),
        api.get('/api/transporters/my-jobs')
      ]);

      setProfile(profileRes.data);
      setAvailableJobs(availableRes.data);
      setMyJobs(myJobsRes.data);
    } catch (error) {
      console.error('Failed to load transporter data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Profile CRUD
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // In real implementation, call update endpoint
      alert('Profile updated successfully');
      setShowProfileEdit(false);
      loadTransporterData();
    } catch (error) {
      alert('Failed to update profile');
    }
  };

  const handleDeactivateAccount = async () => {
    if (confirm('Deactivate your transporter account?')) {
      // In real implementation, call deactivate endpoint
      alert('Account deactivation requested');
    }
  };

  // Job Management
  const handleAcceptJob = async (job: TransportRequest) => {
    const driverPhone = prompt('Enter driver phone number:');
    if (!driverPhone) return;

    try {
      await api.post(`/api/transporters/job/${job.id}/accept`, { driverPhone });
      alert('Job accepted successfully!');
      loadTransporterData();
    } catch (error: any) {
      alert(error.response?.data || 'Failed to accept job');
    }
  };

  const handleRejectJob = async (job: TransportRequest) => {
    if (confirm('Reject this transport job?')) {
      // In real implementation, call reject endpoint
      alert('Job rejected');
      loadTransporterData();
    }
  };

  const handleUpdateJobStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    try {
      await api.post(`/api/transporters/job/${selectedJob.id}/update-status`, {
        status: statusForm.status,
        notes: statusForm.notes,
        proofOfDeliveryUrl: statusForm.proofOfDeliveryUrl
      });
      alert('Job status updated successfully!');
      setShowStatusModal(false);
      setStatusForm({ status: '', notes: '', proofOfDeliveryUrl: '' });
      setSelectedJob(null);
      loadTransporterData();
    } catch (error: any) {
      alert(error.response?.data || 'Failed to update job status');
    }
  };

  const handleConfirmPickup = async (job: TransportRequest) => {
    try {
      await api.post(`/api/transporters/job/${job.id}/pickup`);
      alert('Pickup confirmed!');
      loadTransporterData();
    } catch (error: any) {
      alert(error.response?.data || 'Failed to confirm pickup');
    }
  };

  const handleConfirmDelivery = async (job: TransportRequest) => {
    const proofUrl = prompt('Enter proof of delivery URL (optional):') || '';
    try {
      await api.post(`/api/transporters/job/${job.id}/delivery`, {
        proofOfDeliveryUrl: proofUrl
      });
      alert('Delivery confirmed!');
      loadTransporterData();
    } catch (error: any) {
      alert(error.response?.data || 'Failed to confirm delivery');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading transporter dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = {
    availableJobs: availableJobs.length,
    activeJobs: myJobs.filter(j => j.status === 'Accepted' || j.status === 'InTransit').length,
    completedJobs: myJobs.filter(j => j.status === 'Delivered').length,
    totalEarnings: myJobs.filter(j => j.status === 'Delivered').reduce((sum, j) => sum + (j.transportFee || 0), 0)
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2">Transporter Dashboard</h1>
              <p className="text-orange-100">Welcome back, {user?.fullName}</p>
            </div>
            {profile && (
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-6 py-4">
                <p className="text-sm text-orange-100">Vehicle</p>
                <p className="text-xl font-semibold">{profile.vehicleType} • {profile.vehiclePlate}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Available Jobs</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.availableJobs}</p>
              </div>
              <div className="bg-orange-100 rounded-full p-4">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Active Jobs</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.activeJobs}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Completed</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.completedJobs}</p>
              </div>
              <div className="bg-green-100 rounded-full p-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Earnings</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalEarnings.toLocaleString()} RWF</p>
              </div>
              <div className="bg-yellow-100 rounded-full p-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-xl shadow-lg mb-6">
          <div className="flex space-x-1 p-2 border-b border-gray-200 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'available', label: 'Available Jobs', icon: '📋' },
              { id: 'my-jobs', label: 'My Jobs', icon: '🚛' },
              { id: 'profile', label: 'Profile', icon: '👤' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Available Jobs</h2>
              <div className="space-y-3">
                {availableJobs.slice(0, 5).map((job) => (
                  <div key={job.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{job.crop} • {job.quantityKg}kg</h3>
                        <p className="text-sm text-gray-600">{job.pickupLocation} → {job.deliveryLocation}</p>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        Available
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">My Active Jobs</h2>
              <div className="space-y-3">
                {myJobs.filter(j => j.status === 'Accepted' || j.status === 'InTransit').slice(0, 5).map((job) => (
                  <div key={job.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{job.crop} • {job.quantityKg}kg</h3>
                        <p className="text-sm text-gray-600">{job.pickupLocation} → {job.deliveryLocation}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        job.status === 'InTransit' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Available Jobs Tab */}
        {activeTab === 'available' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Available Transport Jobs</h2>
            <div className="space-y-4">
              {availableJobs.map((job) => (
                <div key={job.id} className="border-2 rounded-xl p-6 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{job.crop} • {job.quantityKg}kg</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                          <p className="text-gray-600">Pickup:</p>
                          <p className="font-medium">{job.pickupLocation}</p>
                          <p className="text-xs text-gray-500">{new Date(job.pickupDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Delivery:</p>
                          <p className="font-medium">{job.deliveryLocation}</p>
                          <p className="text-xs text-gray-500">{new Date(job.deliveryDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="bg-orange-50 p-3 rounded-lg">
                        <p className="text-sm"><strong>Transport Fee:</strong> {job.transportFee?.toLocaleString()} RWF</p>
                      </div>
                    </div>
                    <span className="px-4 py-2 bg-green-100 text-green-800 rounded-lg text-sm font-medium ml-4">
                      Available
                    </span>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleAcceptJob(job)}
                      className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
                    >
                      Accept Job
                    </button>
                    <button
                      onClick={() => handleRejectJob(job)}
                      className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Jobs Tab */}
        {activeTab === 'my-jobs' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">My Transport Jobs</h2>
            <div className="space-y-4">
              {myJobs.map((job) => (
                <div key={job.id} className="border-2 rounded-xl p-6 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{job.crop} • {job.quantityKg}kg</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                          <p className="text-gray-600">Pickup:</p>
                          <p className="font-medium">{job.pickupLocation}</p>
                          <p className="text-xs text-gray-500">{new Date(job.pickupDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Delivery:</p>
                          <p className="font-medium">{job.deliveryLocation}</p>
                          <p className="text-xs text-gray-500">{new Date(job.deliveryDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {job.assignedTruck && (
                        <div className="bg-gray-50 p-3 rounded-lg mb-3">
                          <p className="text-sm"><strong>Vehicle:</strong> {job.assignedTruck}</p>
                          {job.driverPhone && <p className="text-sm"><strong>Driver:</strong> {job.driverPhone}</p>}
                        </div>
                      )}
                      <div className="bg-orange-50 p-3 rounded-lg">
                        <p className="text-sm"><strong>Transport Fee:</strong> {job.transportFee?.toLocaleString()} RWF</p>
                      </div>
                    </div>
                    <span className={`px-4 py-2 rounded-lg text-sm font-medium ml-4 ${
                      job.status === 'Delivered' ? 'bg-green-100 text-green-800' :
                      job.status === 'InTransit' ? 'bg-blue-100 text-blue-800' :
                      job.status === 'Accepted' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {job.status}
                    </span>
                  </div>

                  <div className="flex space-x-3">
                    {job.status === 'Accepted' && (
                      <button
                        onClick={() => handleConfirmPickup(job)}
                        className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Confirm Pickup
                      </button>
                    )}
                    {job.status === 'InTransit' && (
                      <button
                        onClick={() => {
                          setSelectedJob(job);
                          setStatusForm({ status: 'Delivered', notes: '', proofOfDeliveryUrl: '' });
                          setShowStatusModal(true);
                        }}
                        className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
                      >
                        Confirm Delivery
                      </button>
                    )}
                    {(job.status === 'Accepted' || job.status === 'InTransit') && (
                      <button
                        onClick={() => {
                          setSelectedJob(job);
                          setStatusForm({ status: job.status, notes: '', proofOfDeliveryUrl: '' });
                          setShowStatusModal(true);
                        }}
                        className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                      >
                        Update Status
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && profile && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">My Profile</h2>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setProfileForm({
                      companyName: profile.companyName,
                      vehicleType: profile.vehicleType,
                      vehiclePlate: profile.vehiclePlate,
                      capacityKg: profile.capacityKg.toString(),
                      phone: profile.phone,
                      availability: profile.isAvailable
                    });
                    setShowProfileEdit(true);
                  }}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors font-medium"
                >
                  Edit Profile
                </button>
                <button
                  onClick={handleDeactivateAccount}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Deactivate Account
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Company Name</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{profile.companyName}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Vehicle Type</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{profile.vehicleType}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Vehicle Plate</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{profile.vehiclePlate}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Capacity</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{profile.capacityKg} kg</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{profile.phone}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Availability</label>
                  <span className={`inline-block px-4 py-2 rounded-lg ${
                    profile.isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {profile.isAvailable ? 'Available' : 'Unavailable'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Profile Edit Modal */}
      <Modal
        isOpen={showProfileEdit}
        onClose={() => setShowProfileEdit(false)}
        title="Edit Profile"
        size="md"
      >
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input
              type="text"
              value={profileForm.companyName}
              onChange={(e) => setProfileForm({...profileForm, companyName: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
            <input
              type="text"
              value={profileForm.vehicleType}
              onChange={(e) => setProfileForm({...profileForm, vehicleType: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Plate</label>
            <input
              type="text"
              value={profileForm.vehiclePlate}
              onChange={(e) => setProfileForm({...profileForm, vehiclePlate: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Capacity (kg)</label>
            <input
              type="number"
              value={profileForm.capacityKg}
              onChange={(e) => setProfileForm({...profileForm, capacityKg: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={profileForm.availability}
              onChange={(e) => setProfileForm({...profileForm, availability: e.target.checked})}
              className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
            />
            <label className="ml-2 text-sm text-gray-700">Available for new jobs</label>
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
            >
              Update Profile
            </button>
            <button
              type="button"
              onClick={() => setShowProfileEdit(false)}
              className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Status Update Modal */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setSelectedJob(null);
        }}
        title="Update Job Status"
        size="md"
      >
        <form onSubmit={handleUpdateJobStatus} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
            <select
              value={statusForm.status}
              onChange={(e) => setStatusForm({...statusForm, status: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              required
            >
              <option value="">Select status</option>
              <option value="Accepted">Accepted</option>
              <option value="InTransit">In Transit</option>
              <option value="Delivered">Delivered</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={statusForm.notes}
              onChange={(e) => setStatusForm({...statusForm, notes: e.target.value})}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              placeholder="Any updates or notes..."
            />
          </div>
          {statusForm.status === 'Delivered' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proof of Delivery URL</label>
              <input
                type="url"
                value={statusForm.proofOfDeliveryUrl}
                onChange={(e) => setStatusForm({...statusForm, proofOfDeliveryUrl: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="https://..."
              />
            </div>
          )}
          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium"
            >
              Update Status
            </button>
            <button
              type="button"
              onClick={() => {
                setShowStatusModal(false);
                setSelectedJob(null);
              }}
              className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
