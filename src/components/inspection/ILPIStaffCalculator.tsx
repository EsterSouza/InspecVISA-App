import React from 'react';
import { AlertTriangle, CheckCircle2, Info, Users2 } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { calculateILPIStaffing } from '../../utils/ilpiStaffing';

interface ILPIStaffCalculatorProps {
  level1: number;
  level2: number;
  level3: number;
  currentCaregivers: number;
  currentNursingTechs?: number;
  usableAreaM2?: number;
  currentCleaningStaff?: number;
  isRJ?: boolean;
}

function StatusIcon({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle2 className="h-5 w-5 text-green-600" />
    : <AlertTriangle className="h-5 w-5 text-red-600" />;
}

function Delta({ ok, actual, required }: { ok: boolean; actual: number; required: number }) {
  return (
    <p className={`text-xl font-bold ${ok ? 'text-green-600' : 'text-red-600'}`}>
      {ok ? `+${actual - required}` : `-${required - actual}`}
    </p>
  );
}

export function ILPIStaffCalculator({
  level1,
  level2,
  level3,
  currentCaregivers,
  currentNursingTechs = 0,
  usableAreaM2 = 0,
  currentCleaningStaff = 0,
  isRJ = false,
}: ILPIStaffCalculatorProps) {
  const hasResidents = level1 + level2 + level3 > 0;
  const summary = calculateILPIStaffing({
    level1,
    level2,
    level3,
    observedCaregivers: currentCaregivers,
    observedNursingTechs: currentNursingTechs,
    usableAreaM2,
    observedCleaningStaff: currentCleaningStaff,
    isRJ,
  });

  if (!hasResidents) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <p className="text-sm text-amber-700">
          Preencha o numero de residentes por grau de dependencia para calcular o dimensionamento minimo.
        </p>
      </div>
    );
  }

  const caregiverTitle = isRJ ? 'Cuidadores - Lei 8.049/2018 (RJ)' : 'Cuidadores - RDC 502/2021';
  const caregiverRatios = isRJ
    ? ['Grau I (1:20)', 'Grau II (1:10)', 'Grau III (1:8)']
    : ['Grau I (1:20)', 'Grau II (1:10)', 'Grau III (1:6)'];

  return (
    <div className="space-y-3">
      <Card className={summary.caregiversOk ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users2 className={summary.caregiversOk ? 'text-green-600' : 'text-red-600'} />
              <h4 className="text-sm font-bold text-gray-900">{caregiverTitle}</h4>
            </div>
            <StatusIcon ok={summary.caregiversOk} />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold uppercase text-gray-500">
            <div className="rounded bg-white/60 p-2">{caregiverRatios[0]}<br /><span className="text-base text-gray-800">{summary.caregivers.grau1}</span></div>
            <div className="rounded bg-white/60 p-2">{caregiverRatios[1]}<br /><span className="text-base text-gray-800">{summary.caregivers.grau2}</span></div>
            <div className="rounded bg-white/60 p-2">{caregiverRatios[2]}<br /><span className="text-base text-gray-800">{summary.caregivers.grau3}</span></div>
          </div>

          <div className="flex items-end justify-between border-t border-gray-200 pt-3">
            <div>
              <p className="text-xs text-gray-500">Total necessario por turno</p>
              <p className="text-2xl font-black text-gray-900">{summary.caregivers.total}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Deficit / Superavit</p>
              <Delta ok={summary.caregiversOk} actual={currentCaregivers} required={summary.caregivers.total} />
            </div>
          </div>
        </CardContent>
      </Card>

      {isRJ && summary.nursingTechs.total > 0 && (
        <Card className={summary.nursingTechsOk ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users2 className={summary.nursingTechsOk ? 'text-green-600' : 'text-red-600'} />
                <h4 className="text-sm font-bold text-gray-900">Tecnicos de enfermagem - Lei 8.049/2018 (RJ)</h4>
              </div>
              <StatusIcon ok={summary.nursingTechsOk} />
            </div>
            <p className="text-xs text-gray-500">
              Minimo: Grau II 1:15 ({summary.nursingTechs.grau2}) e Grau III 1:10 ({summary.nursingTechs.grau3}).
            </p>
            <div className="flex items-end justify-between border-t border-gray-200 pt-3">
              <div>
                <p className="text-xs text-gray-500">Total necessario por turno</p>
                <p className="text-2xl font-black text-gray-900">{summary.nursingTechs.total}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Deficit / Superavit</p>
                <Delta ok={summary.nursingTechsOk} actual={currentNursingTechs} required={summary.nursingTechs.total} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {summary.cleaningStaff.total > 0 && (
        <Card className={summary.cleaningStaffOk ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users2 className={summary.cleaningStaffOk ? 'text-green-600' : 'text-red-600'} />
                <h4 className="text-sm font-bold text-gray-900">Profissionais de limpeza</h4>
              </div>
              <StatusIcon ok={summary.cleaningStaffOk} />
            </div>
            <p className="text-xs text-gray-500">
              Minimo: 1 profissional para cada 100 m2 ou fracao de area util informada ({summary.cleaningStaff.areaM2} m2).
            </p>
            <div className="flex items-end justify-between border-t border-gray-200 pt-3">
              <div>
                <p className="text-xs text-gray-500">Total necessario por turno</p>
                <p className="text-2xl font-black text-gray-900">{summary.cleaningStaff.total}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Deficit / Superavit</p>
                <Delta ok={summary.cleaningStaffOk} actual={currentCleaningStaff} required={summary.cleaningStaff.total} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!summary.allOk && (
        <p className="rounded bg-red-100 p-2 text-[11px] font-medium text-red-700">
          Atencao: ha nao conformidade no dimensionamento de pessoal. Tecnico de enfermagem nao substitui cuidador no calculo de cuidadores.
        </p>
      )}
    </div>
  );
}
