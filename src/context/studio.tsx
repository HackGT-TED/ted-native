import { createContext, ReactNode, useContext, useState } from 'react';
export type Creation = {
  id: string;
  title: string;
  author: string;
  category: string;
  color: string;
  subtitle: string;
  price: string;
  illustrated?: boolean;
};
export const originals: Creation[] = [{
  id: 'woodland',
  title: 'The Woodland\nCompanion',
  author: 'Florence & Fern',
  category: 'Stories',
  color: '#E2E6D8',
  subtitle: 'A collection of small adventures',
  price: '$12',
  illustrated: true
}, {
  id: 'ordinary',
  title: 'The art of\nordinary days',
  author: 'Eleanor Rose',
  category: 'Journals',
  color: '#E9DDCC',
  subtitle: 'A journal for noticing more',
  price: '$8'
}, {
  id: 'wildflowers',
  title: 'Wildflowers\n& little wonders',
  author: 'The Quiet Studio',
  category: 'Prints',
  color: '#E0E1CF',
  subtitle: 'Botanical notes from the meadow',
  price: '$6'
}, {
  id: 'sunday',
  title: 'A pocketful\nof Sundays',
  author: 'Oliver Moss',
  category: 'Stories',
  color: '#EAD8CD',
  subtitle: 'Stories for taking your time',
  price: '$10'
}];
type Studio = {
  name: string;
  signIn: (name: string) => void;
  signOut: () => void;
  creations: Creation[];
  addCreation: (item: Creation) => void;
  saved: string[];
  toggleSave: (id: string) => void;
};
const Context = createContext<Studio | null>(null);
export function StudioProvider({
  children
}: {
  children: ReactNode;
}) {
  const [name, setName] = useState('');
  const [creations, setCreations] = useState(originals);
  const [saved, setSaved] = useState<string[]>([]);
  return <Context.Provider value={{
    name,
    signIn: setName,
    signOut: () => setName(''),
    creations,
    addCreation: item => setCreations(items => [item, ...items]),
    saved,
    toggleSave: id => setSaved(items => items.includes(id) ? items.filter(i => i !== id) : [...items, id])
  }}>{children}</Context.Provider>;
}
export function useStudio() {
  const studio = useContext(Context);
  if (!studio) throw new Error('StudioProvider is required');
  return studio;
}
