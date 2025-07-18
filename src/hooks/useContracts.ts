import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Contract, Session, ContractSession } from '../types'

export function useContracts() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchContracts()
  }, [])

  const fetchContracts = async () => {
    try {
      setLoading(true)
      setError(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('User not authenticated')
        return
      }

      const { data, error: fetchError } = await supabase
        .from('contracts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      setContracts(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const addContract = async (
    contract: Omit<Contract, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('contracts')
        .insert([{ ...contract, user_id: user.id }])
        .select()
        .single()

      if (error) throw error

      setContracts(prev => [data, ...prev])
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add contract')
    }
  }

  const updateContract = async (
    id: string,
    updates: Partial<Omit<Contract, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ) => {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setContracts(prev => prev.map(c => (c.id === id ? data : c)))
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update contract')
    }
  }

  const deleteContract = async (id: string) => {
    try {
      const { error } = await supabase.from('contracts').delete().eq('id', id)

      if (error) throw error

      setContracts(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete contract')
    }
  }

  const findOrCreateContract = async (name: string): Promise<Contract> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // First, try to find existing contract
      const { data: existingContract, error: findError } = await supabase
        .from('contracts')
        .select('*')
        .eq('user_id', user.id)
        .eq('name', name)
        .eq('status', 'active')
        .single()

      if (findError && findError.code !== 'PGRST116') {
        throw findError
      }

      if (existingContract) {
        return existingContract
      }

      // If not found, create new contract
      const { data: newContract, error: createError } = await supabase
        .from('contracts')
        .insert([{ name, user_id: user.id, status: 'active' }])
        .select()
        .single()

      if (createError) throw createError

      setContracts(prev => [newContract, ...prev])
      return newContract
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to find or create contract')
    }
  }

  return {
    contracts,
    loading,
    error,
    addContract,
    updateContract,
    deleteContract,
    findOrCreateContract,
    refetch: fetchContracts,
  }
}

export function useSessions(projectId?: string) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSessions([]) // Clear sessions immediately when project changes
    fetchSessions()
  }, [projectId])

  const fetchSessions = async () => {
    try {
      setLoading(true)
      setError(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('User not authenticated')
        return
      }

      let query = supabase
        .from('sessions')
        .select('*, projects(name, color)')
        .eq('user_id', user.id)

      if (projectId) {
        query = query.eq('project_id', projectId)
      }

      const { data, error: fetchError } = await query.order('scheduled_date', { ascending: true })

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      setSessions(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const addSession = async (
    session: Omit<Session, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('sessions')
        .insert([{ ...session, user_id: user.id }])
        .select()
        .single()

      if (error) throw error

      setSessions(prev => [data, ...prev])
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to add session')
    }
  }

  const updateSession = async (
    id: string,
    updates: Partial<Omit<Session, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ) => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setSessions(prev => prev.map(s => (s.id === id ? data : s)))
      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to update session')
    }
  }

  const deleteSession = async (id: string) => {
    try {
      const { error } = await supabase.from('sessions').delete().eq('id', id)

      if (error) throw error

      setSessions(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete session')
    }
  }

  const linkSessionToContract = async (sessionId: string, contractId: string) => {
    try {
      const { data, error } = await supabase
        .from('contract_sessions')
        .insert([{ session_id: sessionId, contract_id: contractId }])
        .select()
        .single()

      if (error) throw error

      return data
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to link session to contract')
    }
  }

  const createSessionsWithContract = async (
    contractName: string,
    projectId: string,
    sessionData: Array<{ date: Date; hours: number }>
  ) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Find or create contract
      const { data: contract, error: contractError } = await supabase
        .from('contracts')
        .select('*')
        .eq('user_id', user.id)
        .eq('name', contractName)
        .eq('status', 'active')
        .single()

      let finalContract
      if (contractError && contractError.code === 'PGRST116') {
        // Contract doesn't exist, create it
        const { data: newContract, error: createError } = await supabase
          .from('contracts')
          .insert([{ name: contractName, user_id: user.id, status: 'active' }])
          .select()
          .single()

        if (createError) throw createError
        finalContract = newContract
      } else if (contractError) {
        throw contractError
      } else {
        finalContract = contract
      }

      // Create sessions
      const sessionsToInsert = sessionData.map(({ date, hours }) => ({
        project_id: projectId,
        user_id: user.id,
        scheduled_date: date.toISOString().split('T')[0],
        scheduled_hours: hours,
        status: 'scheduled' as const,
      }))

      const { data: newSessions, error: sessionsError } = await supabase
        .from('sessions')
        .insert(sessionsToInsert)
        .select()

      if (sessionsError) throw sessionsError

      // Link sessions to contract
      const contractSessionsToInsert = newSessions.map(session => ({
        contract_id: finalContract.id,
        session_id: session.id,
      }))

      const { error: linkError } = await supabase
        .from('contract_sessions')
        .insert(contractSessionsToInsert)

      if (linkError) throw linkError

      // Update local state
      setSessions(prev => [...newSessions, ...prev])

      return { contract: finalContract, sessions: newSessions }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to create sessions with contract')
    }
  }

  return {
    sessions,
    loading,
    error,
    addSession,
    updateSession,
    deleteSession,
    linkSessionToContract,
    createSessionsWithContract,
    refetch: fetchSessions,
  }
}
