import dayjs from 'dayjs'
import 'dayjs/locale/th'
import buddhistEra from 'dayjs/plugin/buddhistEra'
import relativeTime from 'dayjs/plugin/relativeTime'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(buddhistEra)
dayjs.extend(relativeTime)
dayjs.extend(customParseFormat)
dayjs.locale('th')

export default dayjs
