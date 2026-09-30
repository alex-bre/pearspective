import { useStore } from '../../../state/store'
import { LABELS } from '../../../model/objects'
import { Group, TextInput } from '../../common/Controls'

/** Properties of the selection. With several selected, the last one picked is edited. */
export default function ArrangeTab() {
  const count = useStore((s) => s.selection.length)
  const obj = useStore((s) => s.document.objects[s.selection[s.selection.length - 1]])
  const renameObject = useStore((s) => s.renameObject)

  return (
    <Group title={count > 1 ? `${count} selected · editing last` : LABELS[obj.type]}>
      <TextInput value={obj.name} onChange={(name) => renameObject(obj.id, name)} />
    </Group>
  )
}
