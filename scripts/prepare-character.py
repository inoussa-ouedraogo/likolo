# Adapt the CC0 Quaternius base to a light, recolorable sports avatar.
import bpy,os,sys,math
from mathutils import Vector
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
source=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else os.path.join(os.path.dirname(root),'asset-source/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)
for o in list(bpy.context.scene.objects):
 if o.name=='Icosphere':bpy.data.objects.remove(o,do_unlink=True)
def material(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.72;return m
skin=material('Skin',(.16,.065,.029));shirt=material('Shirt',(.035,.19,.10));shorts=material('Shorts',(.025,.045,.065));shoes=material('Shoes',(.8,.75,.64));brows=material('Brows',(.009,.007,.005))
for o in bpy.context.scene.objects:
 if o.type!='MESH':continue
 if o.name=='SuperHero_Male':
  o.data.materials.clear()
  for m in [skin,shirt,shorts,shoes]:o.data.materials.append(m)
  for p in o.data.polygons:
   coords=[o.data.vertices[i].co for i in p.vertices];c=sum(coords,Vector())/len(coords)
   p.material_index=3 if c.z<.115 else 2 if .62<c.z<1.01 and abs(c.x)<.30 else 1 if 1.0<=c.z<1.56 and abs(c.x)<.34 else 0
 elif o.name=='Eyebrows':o.data.materials.clear();o.data.materials.append(brows)
 elif o.name=='Eyes':
  for m in o.data.materials:
   if m.use_nodes:
    for n in list(m.node_tree.nodes):
     if n.type=='NORMAL_MAP':m.node_tree.nodes.remove(n)
 bpy.context.view_layer.objects.active=o
 for p in o.data.polygons:p.use_smooth=True
# Preserve the full humanoid skeleton and original facial topology.
bpy.ops.export_scene.gltf(filepath=root+'/dist/models/likolo-athlete.glb',export_format='GLB',export_animations=False,export_cameras=False,export_lights=False,export_extras=False,export_apply=False)
print('EXPORTED',os.path.getsize(root+'/dist/models/likolo-athlete.glb'))
