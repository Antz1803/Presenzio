import appLogo from "../assets/LogoDark.png";

// One saved choice shared by every printed report (class records and the
// semester-end reports). The key is unchanged so earlier choices carry over.
const KEY = "presenzio-semester-logos";

export function readLogoChoice() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function saveLogoChoice(choice) {
  try {
    localStorage.setItem(KEY, JSON.stringify(choice));
  } catch {
    /* storage unavailable: the choice just won't be remembered */
  }
}

// Options come from the logos uploaded under Profile -> Printing logos, plus
// the app logo and "no logo".
export function logoOptions(profile = {}) {
  return [
    ...(profile.printLogoLeftUrl ? [{ value: "profile-left", label: "My left logo", src: profile.printLogoLeftUrl }] : []),
    ...(profile.printLogoRightUrl ? [{ value: "profile-right", label: "My right logo", src: profile.printLogoRightUrl }] : []),
    { value: "app", label: "Presenzio logo", src: appLogo },
    { value: "none", label: "No logo", src: "" },
  ];
}

// Defaults match how class records always behaved: the left side shows your
// uploaded left logo (or the app logo), the right side your uploaded right
// logo (or nothing).
export function pickLogo(side, options, choice) {
  const has = (value) => options.some((item) => item.value === value);
  const fallback = side === "left" ? (has("profile-left") ? "profile-left" : "app") : has("profile-right") ? "profile-right" : "none";
  return options.find((item) => item.value === choice?.[side]) ?? options.find((item) => item.value === fallback);
}

export function resolvePrintLogos(profile) {
  const options = logoOptions(profile);
  const choice = readLogoChoice();
  return { left: pickLogo("left", options, choice).src, right: pickLogo("right", options, choice).src };
}
