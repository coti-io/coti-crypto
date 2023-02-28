export type GetUserTrustScoreDto = {
    status: string;
    userHash: string;
    trustScore: number;
    userType: string;
};

export type SendAddressToNodeDto = {
    status: string;
    address: string;
    addressStatus: string;
}
