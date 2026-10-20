/** Licensed public landing photography — see docs/design/public-landing-photography-manifest.md */

export const LANDING_PHOTO_PATHS = {
  expresswayConstructionSeeduwa: "/landing/photos/expressway-construction-seeduwa.jpg",
  southernExpressway: "/landing/photos/southern-expressway-sri-lanka.jpg",
  roadConstructionWilpattu: "/landing/photos/road-construction-wilpattu.jpg",
} as const;

export type LandingPhotoId = keyof typeof LANDING_PHOTO_PATHS;
