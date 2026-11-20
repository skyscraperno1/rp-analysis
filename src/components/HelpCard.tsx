import { HelpCircle, X } from 'lucide-react';
import { useStore } from '../store/useStore';

/** 快捷键说明分组：键位用 <kbd> 显示，描述紧跟其后 */
const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: '文件',
    items: [
      ['打开图片', '选过一次就记住，下次进页面自动加载'],
      ['导入 JSON', '同样记住；重新选择会覆盖'],
      ['拖入窗口', '直接加载，不计入记忆'],
      ['清除缓存', '忘掉记住的文件，不影响当前画面'],
    ],
  },
  {
    title: '视图',
    items: [
      ['滚轮', '上下平移'],
      ['Ctrl + 滚轮', '以光标为中心缩放'],
      ['空格 + 拖动', '平移画布'],
      ['F', '适应宽度'],
      ['1', '100% 缩放'],
    ],
  },
  {
    title: '工具',
    items: [
      ['V', '选择'],
      ['D', '画新框：空白处按下拖动'],
      ['H', '平移模式'],
    ],
  },
  {
    title: '编辑',
    items: [
      ['单击', '选中；Shift / Ctrl + 单击 多选'],
      ['空白处拖动', '框选'],
      ['拖动手柄', '改大小；拖动方框 = 移动'],
      ['方向键', '微移 1px（Shift = 10px）'],
      ['Del', '删除选中'],
      ['Ctrl+Z', '撤销'],
      ['Ctrl+Shift+Z', '重做'],
      ['Ctrl+A', '全选'],
    ],
  },
  {
    title: '轨道',
    items: [
      ['方框颜色', '竖排的每一列 = 一条轨道'],
      ['右侧属性面板', '可修改该点位的轨道号'],
      ['左侧 / 底部图例', '点色块只看这一列，再点一次取消'],
    ],
  },
];

/** 画布右下角的使用说明：一个小圆钮常驻，卡片收在它正上方、朝左展开。
 *  全程序只有"添加完图片"那一下会自动展开（store 的 setImage 把 helpOpen 置 true），
 *  之后点圆钮就是手动切换（展开时图标变成 ×）。
 *  卡片是绝对定位、层级高于其他画布浮层，会盖住缩略图/工具栏，读完点一下就收起 */
export function HelpCard() {
  const helpOpen = useStore((s) => s.helpOpen);
  const setHelpOpen = useStore((s) => s.setHelpOpen);

  return (
    <>
      <button
        className="help-fab"
        title={helpOpen ? '收起使用说明' : '使用说明'}
        aria-label={helpOpen ? '收起使用说明' : '使用说明'}
        aria-expanded={helpOpen}
        onClick={() => setHelpOpen(!helpOpen)}
      >
        {helpOpen ? <X size={17} strokeWidth={2.1} /> : <HelpCircle size={18} strokeWidth={1.9} />}
      </button>
      <div className={`help-card${helpOpen ? '' : ' is-closed'}`} aria-hidden={!helpOpen} inert={!helpOpen}>
        <div className="help-head">
          <span className="help-title">使用说明</span>
        </div>
        <div className="help-body">
          {GROUPS.map((g) => (
            <div className="help-group" key={g.title}>
              <div className="help-group-title">{g.title}</div>
              {g.items.map(([key, desc]) => (
                <div className="help-row" key={key}>
                  <kbd>{key}</kbd>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="help-foot">把图片或 JSON 拖进窗口也可以直接加载</div>
      </div>
    </>
  );
}
