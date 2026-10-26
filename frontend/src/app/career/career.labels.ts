import { Education, Situation, TrainTime, WorkType } from './career.data';
import { EN_EDUCATIONS, EN_SITUATIONS, EN_TIMES, EN_WORKS } from './career.en';
import type { CareerLang } from './career.local';

/** The answers as the questions offer them (the page's buttons) and as the printed plan words them. */
export const SITUATIONS: { value: Situation; label: string }[] = [
  { value: 'unemployed', label: 'Đang thất nghiệp' },
  { value: 'switching', label: 'Muốn đổi nghề' },
  { value: 'graduate', label: 'Mới ra trường' },
  { value: 'employed', label: 'Đang đi làm, muốn tham khảo thị trường' },
];
export const EDUCATIONS: { value: Education; label: string }[] = [
  { value: 0, label: 'Phổ thông' },
  { value: 1, label: 'Trung cấp, cao đẳng' },
  { value: 2, label: 'Đại học trở lên' },
];
export const TIMES: { value: TrainTime; label: string }[] = [
  { value: 0, label: 'Cần bắt đầu ngay' },
  { value: 1, label: 'Có vài tháng để học thêm' },
  { value: 2, label: 'Có từ một năm' },
];
export const WORKS: { value: WorkType; label: string }[] = [
  { value: 'employee', label: 'Làm thuê' },
  { value: 'self', label: 'Tự kinh doanh' },
  { value: 'either', label: 'Cả hai đều được' },
];

/** The same lists in the page's language (the values, which are stored, do not change). */
export const labelsIn = (lang: CareerLang) =>
  lang === 'vi'
    ? { situations: SITUATIONS, educations: EDUCATIONS, times: TIMES, works: WORKS }
    : {
        situations: SITUATIONS.map((o) => ({ ...o, label: EN_SITUATIONS[o.value] })),
        educations: EDUCATIONS.map((o) => ({ ...o, label: EN_EDUCATIONS[o.value] })),
        times: TIMES.map((o) => ({ ...o, label: EN_TIMES[o.value] })),
        works: WORKS.map((o) => ({ ...o, label: EN_WORKS[o.value] })),
      };
