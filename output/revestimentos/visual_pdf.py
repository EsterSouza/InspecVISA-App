from pathlib import Path
p=Path('output/revestimentos/gerar.py');s=p.read_text(encoding='utf-8')
s=s.replace("from reportlab.platypus import Paragraph, Frame, KeepTogether, Spacer","from reportlab.platypus import Paragraph, Frame, KeepTogether, Spacer, Flowable")
s=s.replace("PAGE=0; contents=[]",'''class Sample(Flowable):
 def __init__(self,idx):
  Flowable.__init__(self);self.idx=idx;self.width=511;self.height=42
 def draw(self):
  cc=self.canv;cc.saveState();path=cc.beginPath();path.rect(0,6,90,32);cc.clipPath(path,stroke=0)
  cc.drawImage(str(ROOT/'assets'/'materiais.png'),-(self.idx%4)*90,6-(1-self.idx//4)*32,360,64)
  cc.restoreState();cc.setFont('Body',8);cc.setFillColor(MUTE);cc.drawString(102,19,'Textura ilustrativa da família. Confirme o produto e o acabamento.')
PAGE=0; contents=[]''')
s=s.replace("flow.extend([p(m['id']+' · '+m['name'],h3),p(m['status'],small)])","flow.extend([p(m['id']+' · '+m['name'],h3),p(m['status'],small),Sample(tile(m))])")
p.write_text(s,encoding='utf-8')
