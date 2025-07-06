# Xenova-clone-all-MiniLM-L6-v2


Cloned repo of https://huggingface.co/Xenova/all-MiniLM-L6-v2



```
docker run -d --name hugging-face-text-embedding -p 8080:80 jgquiroga/hugging-face-text-embedding:v0.4.0
curl --location 'http://127.0.0.1:8080/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2' --header 'Accept: application/json' --header 'Content-Type: application/json' --data '{"inputs": ["This is a test sentence"]}'

npx chroma run
```
