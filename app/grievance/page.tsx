'use client'

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

interface Grievance {
  id?: string;
  user_id?: string;
  ticket_number?: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  created_at?: string;
  resolution?: string;
}

export default function GrievancePage() {
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [newGrievance, setNewGrievance] = useState<Grievance>({
    category: '',
    subject: '',
    description: '',
    status: 'pending'
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClientComponentClient();
  const router = useRouter();

  const fetchGrievances = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('grievances')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setGrievances(data);
    } catch (err) {
      console.error('Error fetching grievances:', err);
      setError('Failed to load grievances');
    }
  };

  useEffect(() => {
    fetchGrievances(); // Call fetchGrievances when the component mounts
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const ticketNumber = `GR${Date.now().toString().slice(-6)}`;

      const { error: submitError } = await supabase
        .from('grievances')
        .insert({
          user_id: session.user.id,
          ticket_number: ticketNumber,
          ...newGrievance
        });

      if (submitError) throw submitError;

      setSuccess(true);
      setNewGrievance({
        category: '',
        subject: '',
        description: '',
        status: 'pending'
      });
      fetchGrievances(); // Fetch grievances again to reflect the new grievance
    } catch (err) {
      console.error('Error submitting grievance:', err);
      setError('Failed to submit grievance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h1 className="text-2xl font-bold mb-6 text-black">Grievance Redressal</h1>

          

          {/* Submit New Grievance */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-black">Submit Grievance</h2>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
                Grievance submitted successfully. We will respond within 7 working days.
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black mb-1">
                  Category
                </label>
                <select
                  value={newGrievance.category}
                  onChange={(e) => setNewGrievance({...newGrievance, category: e.target.value})}
                  className="w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                  required
                >
                  <option value="">Select Category</option>
                  <option value="technical">Technical Issue</option>
                  <option value="account">Account Related</option>
                  <option value="payment">Payment Related</option>
                  <option value="service">Service Related</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={newGrievance.subject}
                  onChange={(e) => setNewGrievance({...newGrievance, subject: e.target.value})}
                  className="w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-1">
                  Description
                </label>
                <textarea
                  value={newGrievance.description}
                  onChange={(e) => setNewGrievance({...newGrievance, description: e.target.value})}
                  rows={4}
                  className="w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Grievance'}
              </button>
            </form>
          </div>

          {/* Grievance History */}
          <div>
            <h2 className="text-lg font-semibold mb-4 text-black">Grievance History</h2>
            <div className="space-y-4">
              {grievances.length === 0 ? (
                <p className="text-black text-center py-4">No grievances found</p>
              ) : (
                grievances.map((grievance) => (
                  <div key={grievance.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium text-black">{grievance.subject}</h3>
                        <p className="text-sm text-black">
                          Ticket: {grievance.ticket_number} | Category: {grievance.category}
                        </p>
                      </div>
                      <span 
                        className={`px-2 py-1 rounded-full text-xs ${
                          grievance.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          grievance.status === 'resolved' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {grievance.status}
                      </span>
                    </div>
                    <p className="text-black text-sm mb-2">{grievance.description}</p>
                    {grievance.resolution && (
                      <div className="bg-gray-50 p-3 rounded mt-2">
                        <p className="text-sm text-black">
                          <strong>Resolution:</strong> {grievance.resolution}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-black mt-2">
                      Submitted: {new Date(grievance.created_at || '').toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
