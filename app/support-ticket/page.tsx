// app/support-ticket/page.tsx
'use client'

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

interface SupportTicket {
  id?: string;
  user_id?: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  created_at?: string;
}

export default function SupportTicketPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [newTicket, setNewTicket] = useState<SupportTicket>({
    name: '',
    email: '',
    subject: '',
    message: '',
    status: 'pending'
  });
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [isTicketSubmitted, setIsTicketSubmitted] = useState(false);

  const supabase = createClientComponentClient();
  const router = useRouter();

  const fetchTickets = React.useCallback(async (userId: string) => {
    // Explicitly use userId to satisfy TypeScript
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', userId); // Add this line to use userId
  
    if (data) setTickets(data);
    if (error) console.error('Error fetching tickets:', error);
  }, [supabase]);

  // Fix useEffect deps
useEffect(() => {
  const checkUserAndFetchTickets = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setNewTicket(prev => ({
        ...prev,
        name: user.user_metadata?.full_name || '',
        email: user.email || ''
      }));
      fetchTickets(user.id);
    }
  };

  checkUserAndFetchTickets();
}, [fetchTickets, router, supabase]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          name: newTicket.name,
          email: newTicket.email,
          subject: newTicket.subject,
          message: newTicket.message,
          status: 'pending'
        });

      if (error) throw error;

      setIsTicketSubmitted(true);
      setIsCreatingTicket(false);
    } catch (err) {
      console.error('Ticket creation error:', err);
      alert('Failed to create support ticket');
    }
  };

  const handleReset = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setNewTicket({
          name: user.user_metadata?.full_name || '',
          email: user.email || '',
          subject: '',
          message: '',
          status: 'pending'
        });
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
    
    setIsCreatingTicket(false);
    setIsTicketSubmitted(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <Link href="/dashboard" className="text-xl font-bold text-black">
            KillSwitch Pro
          </Link>
        </div>
      </header>

      <div className="p-8">
        {!isTicketSubmitted && (
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-black">Support Tickets</h1>
              <button 
                onClick={() => setIsCreatingTicket(!isCreatingTicket)}
                className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
              >
                {isCreatingTicket ? 'Cancel' : 'Create Ticket'}
              </button>
            </div>

            {isCreatingTicket && (
              <form onSubmit={handleCreateTicket} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={newTicket.name}
                    onChange={(e) => setNewTicket({...newTicket, name: e.target.value})}
                    required
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newTicket.email}
                    onChange={(e) => setNewTicket({...newTicket, email: e.target.value})}
                    required
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={newTicket.subject}
                    onChange={(e) => setNewTicket({...newTicket, subject: e.target.value})}
                    required
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Message
                  </label>
                  <textarea
                    value={newTicket.message}
                    onChange={(e) => setNewTicket({...newTicket, message: e.target.value})}
                    required
                    rows={4}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  />
                </div>
                <button 
                  type="submit"
                  className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
                >
                  Submit Ticket
                </button>
              </form>
            )}

            <div className="grid gap-4">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="bg-white shadow-md rounded-lg p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-black">{ticket.subject}</h3>
                      <p className="text-gray-600 mt-2">{ticket.message}</p>
                    </div>
                    <span 
                      className={`px-3 py-1 rounded-full text-xs ${
                        ticket.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        ticket.status === 'resolved' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {ticket.status}
                    </span>
                  </div>
                  <div className="mt-4 text-sm text-gray-500">
                    Created: {new Date(ticket.created_at || '').toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {tickets.length === 0 && (
              <div className="text-center text-gray-500 mt-10">
                No support tickets found
              </div>
            )}
          </div>
        )}

        {isTicketSubmitted && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-green-800 mb-4">Ticket Created Successfully!</h2>
            <p className="text-gray-600 mb-6">Your support ticket has been submitted. Our team will review it shortly.</p>
            <div className="flex justify-center space-x-4">
              <Link 
                href="/dashboard"
                className="bg-black text-white px-6 py-3 rounded hover:bg-gray-800 inline-block"
              >
                Return to Dashboard
              </Link>
              <button
                onClick={handleReset}
                className="bg-gray-200 text-gray-800 px-6 py-3 rounded hover:bg-gray-300 inline-block"
              >
                Create Another Ticket
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
