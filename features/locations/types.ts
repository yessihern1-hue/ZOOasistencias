export type AttendanceLocation = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  allowedRadiusMeters: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AttendanceLocationInput = {
  name: string;
  latitude: number;
  longitude: number;
  allowedRadiusMeters: number;
};
