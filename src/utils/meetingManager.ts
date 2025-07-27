import { supabase } from '../lib/supabase'

export const addMeeting = async (meetingData: any) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('meetings')
      .insert({ ...meetingData, user_id: user.id })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error adding meeting:', error)
    throw error
  }
}

export const updateMeeting = async (id: string, meetingData: any) => {
  try {
    const { data, error } = await supabase
      .from('meetings')
      .update(meetingData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating meeting:', error)
    throw error
  }
}

export const deleteMeeting = async (id: string) => {
  try {
    const { error } = await supabase
      .from('meetings')
      .delete()
      .eq('id', id)

    if (error) throw error
  } catch (error) {
    console.error('Error deleting meeting:', error)
    throw error
  }
}