
export interface LinkCategory {
  id: string;
  name: string;
  links: WebLink[];
}

export interface WebLink {
  id: string;
  title: string;
  url: string;
  description?: string;
  icon?: string;
}

export interface AIResponse {
  categories: LinkCategory[];
}
