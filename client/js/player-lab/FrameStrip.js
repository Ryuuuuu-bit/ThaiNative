// A fixed foot baseline makes frame-to-frame drift visible during art review.
export class FrameStrip {
  constructor(element,onSelect){this.element=element;this.onSelect=onSelect;this.signature='';this.frame=-1;}
  update(player){
    const layer=player.layers.get('body');
    const sequence=layer?.spec.layouts?.[player.clip]?.directions?.[player.row];
    this.element.hidden=!sequence;
    if(!sequence)return;
    const signature=`${player.versions.get('body')}:${player.clip}:${player.row}`;
    if(signature!==this.signature){
      this.signature=signature;this.frame=-1;this.element.replaceChildren();
      sequence.forEach((cell,index)=>{
        const texture=layer.textures[cell.source||player.clip];if(!texture)return;
        const button=document.createElement('button');button.type='button';
        button.setAttribute('aria-label',`ดูเฟรม ${index+1}`);button.onclick=()=>this.onSelect(index);
        const canvas=document.createElement('canvas');canvas.width=112;canvas.height=112;
        const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
        ctx.strokeStyle='#547163';ctx.beginPath();ctx.moveTo(8,94.5);ctx.lineTo(104,94.5);ctx.stroke();
        const image=texture.image,w=cell.w*image.width,h=cell.h*image.height;
        const scale=1.15/(cell.ppu||layer.spec.presentation[player.clip].sourcePixelsPerUnit);
        ctx.translate(56,94);if(cell.flip)ctx.scale(-1,1);
        ctx.drawImage(image,cell.x*image.width,cell.y*image.height,w,h,-w*(cell.pivotX??.5)*scale,-h*(cell.foot??1)*scale,w*scale,h*scale);
        const label=document.createElement('span');label.textContent=String(index+1);
        button.append(canvas,label);this.element.append(button);
      });
    }
    if(this.frame===player.frame)return;
    this.frame=player.frame;
    [...this.element.children].forEach((button,index)=>{
      button.classList.toggle('selected',index===player.frame);
      button.setAttribute('aria-pressed',String(index===player.frame));
    });
  }
}
