export type AgencyRecord = {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  type: string;
  status: string;
  parentAgencyId: string | null;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  revision: number;
};

export type AgencyListPayload = {
  success: true;
  data: {
    agencies: AgencyRecord[];
    page: number;
    pageSize: number;
    total: number;
  };
};

export type AgencyPayload = {
  success: true;
  data: { agency: AgencyRecord };
};
