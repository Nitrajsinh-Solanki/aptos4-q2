export interface FilterParams {
  searchTerm?: string;  
  priceRange?: [number, number];
    rarity?: string | number;
  }
  
  export type SortOption = 
    | 'price_asc' 
    | 'price_desc' 
    | 'date_desc' 
    | 'date_asc' 
    | 'name_asc' 
    | 'name_desc' 
    | 'id_asc' 
    | 'rarity_desc';
  