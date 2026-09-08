const BASE_DB = "project-captainjohn";

/**
 * Zet de database in een MongoDB-URI om naar een variant, bijv. "test" of
 * "e2e". Zo schrijven tests en seed-scripts nooit in de echte projectdatabase,
 * ook niet als .env naar de productiecluster wijst. URI's die al een andere
 * database gebruiken (zoals project-captainjohn-ci) blijven ongemoeid.
 */
function withDbSuffix(uri, suffix) {
  if (!uri || !suffix) return uri;
  return String(uri).replace(
    new RegExp(`/${BASE_DB}(\\?|$)`),
    `/${BASE_DB}-${suffix}$1`
  );
}

module.exports = { BASE_DB, withDbSuffix };
