# Consistência do reconhecimento facial

O backend usa InsightFace (`buffalo_l` por padrão). O reconhecimento recorta e
alinha o rosto usando cinco pontos faciais antes de extrair o vetor. A comparação
1:1 normaliza os dois vetores e calcula seu produto escalar (similaridade de
cosseno). O limite operacional permanece 0,80. Um valor mostrado como 80% não é
uma probabilidade de identidade nem a taxa de acerto do sistema.

O cadastro atual guarda um único vetor por usuário. Uma referência escura,
inclinada ou muito diferente das condições de uso pode prejudicar as próximas
comparações. A roupa não é uma característica explicitamente comparada, mas luz,
oclusões, pose e câmera podem alterar o rosto capturado. Não há garantia de uma
similaridade fixa para a mesma pessoa.

## Orientação compartilhada de captura

Cadastro, edição da biometria e validação usam o mesmo serviço de webcam:

- A iluminação é medida no centro do rosto detectado, em vez da imagem inteira.
  Fundo e roupa deixam de dominar essa orientação.
- Uma luminância média abaixo de 30 ou acima de 235 (escala de 0 a 255) pede
  ajuste da luz antes da captura.
- Inclinação lateral superior a 20 graus, medida pela linha dos olhos, pede
  cabeça reta. Isso não mede todos os ângulos de pose nem a nitidez.
- Continuam as orientações de distância, olhos abertos e expressão neutra.
- A captura compartilhada exige enquadramento pronto inclusive no modo totem.

Esses limites são heurísticas de orientação, não limiares biométricos calibrados.
Não substituem as verificações do backend. A câmera deve ficar na altura dos
olhos, com luz difusa pela frente e sem janela forte atrás. Alterações cosméticas
de contraste ou aumento artificial do score não foram introduzidas.

## Validação antes da apresentação

1. Refaça a biometria pela interface se a referência antiga estiver ruim, usando
   a câmera que será usada na demonstração. A referência anterior é substituída;
   essa atualização deve ser feita conscientemente por um administrador.
2. Faça dez tentativas genuínas, registrando score, aprovação, tempo e câmera.
   Varie luz habitual, roupa e cabelo; mantenha o rosto descoberto.
3. Teste também pessoas diferentes do titular do cartão. Meça rejeições de
   titulares e aceitações indevidas, em vez de escolher o limite apenas pelos
   melhores scores do titular.
4. Repita em celular e notebook separadamente. Não marque o requisito de dez
   acessos como aprovado antes desse teste real.

Se as variações continuarem, avaliar cadastro com várias amostras e uma política
de comparação calibrada em dados genuínos e impostores. Isso exige alterar o
armazenamento e medir o efeito sobre falsas aceitações; não basta aceitar o maior
score ou baixar o limite para a apresentação.

Referências do processamento usado pelo modelo:
[extração e cosseno no InsightFace](https://github.com/deepinsight/insightface/blob/master/python-package/insightface/model_zoo/arcface_onnx.py),
[alinhamento pelos pontos faciais](https://github.com/deepinsight/insightface/blob/master/python-package/insightface/utils/face_align.py).
