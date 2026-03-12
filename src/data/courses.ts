// TODO: Course types (180 lines)

export type Course = {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  holes: number;
  par: number;
  rating?: number;
  slope?: number;
  imageUrl?: string;
};

export type TeeBox = {
  id: string;
  courseId: string;
  name: string;
  color: string;
  rating: number;
  slope: number;
  yardage: number;
};
