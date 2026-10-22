import { Education, Situation, TrainTime, WorkType } from './career.data';

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
