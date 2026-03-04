
import { createClient } from '@supabase/supabase-js';

// REMPLACEZ CES VALEURS PAR CELLES DE VOTRE PROJET SUPABASE
// Vous les trouverez dans Project Settings > API
const SUPABASE_URL = 'https://pamnskatbyohwfgxpwkk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhbW5za2F0YnlvaHdmZ3hwd2trIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMjExNjMsImV4cCI6MjA4NDU5NzE2M30.5hqwDGU2lkxCgwkFwHK2ZKB2or4-YVPlLaN24K524cc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
