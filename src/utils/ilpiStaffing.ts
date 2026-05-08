export interface ILPIStaffingInput {
  level1: number;
  level2: number;
  level3: number;
  observedCaregivers?: number;
  observedNursingTechs?: number;
  isRJ?: boolean;
}

export interface ILPIStaffingRequirement {
  grau1: number;
  grau2: number;
  grau3: number;
  total: number;
}

export interface ILPIStaffingSummary {
  caregivers: ILPIStaffingRequirement;
  nursingTechs: {
    grau2: number;
    grau3: number;
    total: number;
  };
  observedCaregivers: number;
  observedNursingTechs: number;
  caregiversOk: boolean;
  nursingTechsOk: boolean;
  allOk: boolean;
  legalBase: string;
}

function cleanNumber(value: number | undefined) {
  return Math.max(0, Number.isFinite(value || 0) ? value || 0 : 0);
}

export function calcFederalCaregivers(level1: number, level2: number, level3: number): ILPIStaffingRequirement {
  const grau1 = Math.max(0, Math.ceil(cleanNumber(level1) / 20));
  const grau2 = cleanNumber(level2) > 0 ? Math.max(2, Math.ceil(cleanNumber(level2) / 10)) : 0;
  const grau3 = cleanNumber(level3) > 0 ? Math.max(2, Math.ceil(cleanNumber(level3) / 6)) : 0;
  return { grau1, grau2, grau3, total: grau1 + grau2 + grau3 };
}

export function calcRJCaregivers(level1: number, level2: number, level3: number): ILPIStaffingRequirement {
  const grau1 = Math.max(0, Math.ceil(cleanNumber(level1) / 15));
  const grau2 = cleanNumber(level2) > 0 ? Math.max(1, Math.ceil(cleanNumber(level2) / 8)) : 0;
  const grau3 = cleanNumber(level3) > 0 ? Math.max(1, Math.ceil(cleanNumber(level3) / 5)) : 0;
  return { grau1, grau2, grau3, total: grau1 + grau2 + grau3 };
}

export function calcRJNursingTechs(level2: number, level3: number) {
  const l2 = cleanNumber(level2);
  const l3 = cleanNumber(level3);
  const grau2 = l2 > 0 ? Math.ceil(l2 / 15) : 0;
  const grau3 = l3 > 0 ? Math.ceil(l3 / 10) : 0;
  const total = l2 + l3 > 0 ? Math.max(1, grau2 + grau3) : 0;
  return { grau2, grau3, total };
}

export function calculateILPIStaffing(input: ILPIStaffingInput): ILPIStaffingSummary {
  const observedCaregivers = cleanNumber(input.observedCaregivers);
  const observedNursingTechs = cleanNumber(input.observedNursingTechs);
  const caregivers = input.isRJ
    ? calcRJCaregivers(input.level1, input.level2, input.level3)
    : calcFederalCaregivers(input.level1, input.level2, input.level3);
  const nursingTechs = input.isRJ
    ? calcRJNursingTechs(input.level2, input.level3)
    : { grau2: 0, grau3: 0, total: 0 };

  const caregiversOk = observedCaregivers >= caregivers.total;
  const nursingTechsOk = !input.isRJ || nursingTechs.total === 0 || observedNursingTechs >= nursingTechs.total;

  return {
    caregivers,
    nursingTechs,
    observedCaregivers,
    observedNursingTechs,
    caregiversOk,
    nursingTechsOk,
    allOk: caregiversOk && nursingTechsOk,
    legalBase: input.isRJ ? 'RDC 502/2021 e Lei 8.049/2018 (RJ)' : 'RDC 502/2021',
  };
}
