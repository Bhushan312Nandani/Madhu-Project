const fs = require('fs');
let code = fs.readFileSync('c:/Users/AFZAL COMPUTERS/Desktop/Madhu-Project/frontend/src/components/admin/AdminPage.js', 'utf-8');

const imageUploadComponent = `
function ImageUploadInput({ label, value, onChange }) {
  const [uploading, setUploading] = React.useState(false);
  const handleFile = async (e) => {
    if(!e.target.files[0]) return;
    setUploading(true);
    const fd = new FormData(); fd.append('image', e.target.files[0]);
    try {
      const res = await axios.post(\`\${API}/upload\`, fd, { headers: { ...H.headers, 'Content-Type': 'multipart/form-data' } });
      onChange(res.data.imageUrl);
    } catch { alert('Upload failed'); }
    finally { setUploading(false); }
  }
  return (
    <div style={{ flex:1 }}>
      <label style={{ fontSize:10, color:'#666', display:'block', marginBottom:4 }}>{label || 'Image URL'}</label>
      <div style={{ display:'flex', gap:4 }}>
        <input style={{ flex:1, padding:'6px 8px', border:'1px solid #ddd', borderRadius:4, fontSize:12 }} value={value||''} onChange={e=>onChange(e.target.value)} placeholder='Paste URL...' />
        <label style={{ background:'#f0f0f0', border:'1px solid #ddd', padding:'6px', borderRadius:4, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center' }}>
          {uploading ? '...' : '📁 Upload'}
          <input type='file' style={{ display:'none' }} accept='image/*' onChange={handleFile} />
        </label>
      </div>
    </div>
  );
}
`;

code = code.replace('// Reusable product form', imageUploadComponent + '\n// Reusable product form');

// Replace Image URL in ProductForm
code = code.replace(
  '["Old Price","oldPrice","number"],["Image URL","image","text"],["Rating","rating","number"]',
  '["Old Price","oldPrice","number"],["Rating","rating","number"]'
);

code = code.replace(
  '<div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>',
  '<div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>\n        <div style={{ gridColumn:"1 / -1" }}><ImageUploadInput value={f.image} onChange={v=>setF({...f,image:v})} /></div>'
);

// Replace Image URL in Featured
code = code.replace(
  '<div style={{ flex:1 }}><label style={{ fontSize:11, color:"#666" }}>Image URL</label><input style={{ width:"100%", padding:"8px", border:"1px solid #ddd", borderRadius:4 }} value={featured?.products?.bigLeft?.image||""} onChange={e=>setFeatured({...featured, products:{...(featured.products||{}), bigLeft:{...(featured.products?.bigLeft||{}), image:e.target.value}}})} /></div>',
  '<ImageUploadInput label="Image URL" value={featured?.products?.bigLeft?.image||""} onChange={v=>setFeatured({...featured, products:{...(featured.products||{}), bigLeft:{...(featured.products?.bigLeft||{}), image:v}}})} />'
);

code = code.replace(
  '<div style={{ flex:1 }}><label style={{ fontSize:11, color:"#666" }}>Image URL</label><input style={{ width:"100%", padding:"8px", border:"1px solid #ddd", borderRadius:4 }} value={featured?.products?.topRight?.image||""} onChange={e=>setFeatured({...featured, products:{...(featured.products||{}), topRight:{...(featured.products?.topRight||{}), image:e.target.value}}})} /></div>',
  '<ImageUploadInput label="Image URL" value={featured?.products?.topRight?.image||""} onChange={v=>setFeatured({...featured, products:{...(featured.products||{}), topRight:{...(featured.products?.topRight||{}), image:v}}})} />'
);

code = code.replace(
  '<div style={{ flex:1 }}><label style={{ fontSize:11, color:"#666" }}>Image URL</label><input style={{ width:"100%", padding:"8px", border:"1px solid #ddd", borderRadius:4 }} value={p.image||""} onChange={e=>{const br=[...featured.products.bottomRight]; br[i].image=e.target.value; setFeatured({...featured, products:{...featured.products, bottomRight:br}});}} /></div>',
  '<ImageUploadInput label="Image URL" value={p.image||""} onChange={v=>{const br=[...featured.products.bottomRight]; br[i].image=v; setFeatured({...featured, products:{...featured.products, bottomRight:br}});}} />'
);

// Replace Image URL in Banners
code = code.replace(
  '{[["Category Text","category"],["Title","title"],["Image URL","image"],["Button Link","buttonLink"]].map',
  '{[["Category Text","category"],["Title","title"],["Button Link","buttonLink"]].map'
);
code = code.replace(
  '{banner.image && <div',
  '<ImageUploadInput label="Image URL" value={banner.image||""} onChange={v=>setBanner({...banner, image:v})} />\n                {banner.image && <div'
);

// Replace Image URL in sliders
code = code.replace(
  '{[["Main Text","mainText"],["Series Text","seriesText"],["Button Text","buttonText"],["Button Link","link"],["Image URL","image"],["Logo URL","logo"]].map',
  '{[["Main Text","mainText"],["Series Text","seriesText"],["Button Text","buttonText"],["Button Link","link"]].map'
);
code = code.replace(
  '{b.image && <img',
  '<div style={{ display:"flex", gap:12, marginTop:12 }}><ImageUploadInput label="Image URL" value={b.image||""} onChange={v=>{const nb=[...banners]; nb[i].image=v; setBanners(nb);}} /><ImageUploadInput label="Logo URL" value={b.logo||""} onChange={v=>{const nb=[...banners]; nb[i].logo=v; setBanners(nb);}} /></div>\n                      {b.image && <img'
);

// Replace Image URL in About Story
code = code.replace(
  '<div style={{ marginBottom:12 }}><label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>Image URL</label><input style={{ width:"100%", padding:"8px", border:"1px solid #ddd", borderRadius:4 }} value={about?.story?.image||""} onChange={e=>setAbout({...about, story:{...about.story, image:e.target.value}})} /></div>',
  '<div style={{ marginBottom:12 }}><ImageUploadInput label="Image URL" value={about?.story?.image||""} onChange={v=>setAbout({...about, story:{...about.story, image:v}})} /></div>'
);

// Replace Image URL in About Team
code = code.replace(
  '<div><label style={{ fontSize:11, color:"#666" }}>Image URL</label><input style={{ width:"100%", padding:"6px", border:"1px solid #ddd", borderRadius:4 }} value={m.image||""} onChange={e=>{const tm=[...about.team]; tm[i].image=e.target.value; setAbout({...about, team:tm});}} /></div>',
  '<div><ImageUploadInput label="Image URL" value={m.image||""} onChange={v=>{const tm=[...about.team]; tm[i].image=v; setAbout({...about, team:tm});}} /></div>'
);

fs.writeFileSync('c:/Users/AFZAL COMPUTERS/Desktop/Madhu-Project/frontend/src/components/admin/AdminPage.js', code);
