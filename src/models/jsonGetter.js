// MariaDB stocke DataTypes.JSON en LONGTEXT : le driver mysql2 renvoie alors
// une chaîne ("[\"Piscine\"]") au lieu d'un tableau. Ce getter re-parse la
// valeur si besoin, et laisse passer tel quel ce qui est déjà un objet
// (MySQL avec un vrai type JSON).
module.exports = (field) =>
  function jsonGetter() {
    const value = this.getDataValue(field);
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };
