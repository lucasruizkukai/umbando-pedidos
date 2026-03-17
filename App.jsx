import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vewiuuhhossokfhaqkud.supabase.co'
const SUPABASE_KEY = 'sb_publishable_jwkS9S5BAffqqdxSaGKdEQ_WbprGVp3'
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function App() {
  return (
    <div>
      <h1>Minha Loja</h1>
    </div>
  )
}

export default App
