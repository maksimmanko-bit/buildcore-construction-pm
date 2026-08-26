export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function findVisitConflicts(candidate, visits) {
  return visits.filter((visit) => {
    if (visit.id === candidate.id || visit.visit_date !== candidate.visit_date) return false;
    const samePerson = candidate.people.some((personId) => visit.people.includes(personId));
    const sameEquipment = candidate.equipment.some((equipmentId) => visit.equipment.includes(equipmentId));
    return (samePerson || sameEquipment) && overlaps(candidate.start_time, candidate.end_time, visit.start_time, visit.end_time);
  });
}

export function visitStatusLabel(status) {
  return {
    planned: "Запланирован",
    on_site: "В процессе",
    completed: "Завершен",
    cancelled: "Отменен",
  }[status] ?? status;
}
